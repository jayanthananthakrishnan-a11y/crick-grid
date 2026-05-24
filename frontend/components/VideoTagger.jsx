import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Dimensions, Modal
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { saveClip, getClipsForVideo, deleteClip, submitLBWReview } from '../services/api';
import PitchMap from './PitchMap';

const SW = Dimensions.get('window').width;
const VIDEO_H = (SW * 9) / 16;

const CONTACT_COLORS = { middle: '#2e7d32', edge: '#f57f17', leading_edge: '#e65100', miss: '#c62828', pad: '#7b1fa2' };
const VERDICT_COLORS = { OUT: '#c62828', NOT_OUT: '#2e7d32', UMPIRES_CALL: '#f57f17' };

// ─── Mini scrubber bar ────────────────────────────────────────────────────────
function ScrubBar({ duration, currentTime, clips, onSeek }) {
  const barRef = useRef(null);
  const [barWidth, setBarWidth] = useState(SW - 32);

  const handleTouch = (evt) => {
    const { locationX } = evt.nativeEvent;
    const pct = Math.max(0, Math.min(1, locationX / barWidth));
    onSeek(pct * duration);
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View
      style={[styles.scrubBar, { width: barWidth }]}
      onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
    >
      {/* Track */}
      <View style={styles.scrubTrack} />
      {/* Clip markers */}
      {clips.map((c, i) => {
        const left = duration > 0 ? (c.start_time / duration) * 100 : 0;
        const width = duration > 0 ? ((c.end_time - c.start_time) / duration) * 100 : 1;
        return (
          <View
            key={i}
            style={[styles.clipMarker, { left: `${left}%`, width: `${Math.max(width, 1)}%` }]}
          />
        );
      })}
      {/* Playhead */}
      <View style={[styles.playhead, { left: `${pct}%` }]} />
    </View>
  );
}

// ─── Ball data card (shown when a ball is selected) ───────────────────────────
function BallDataCard({ ball, onDRSPress }) {
  if (!ball) return null;
  return (
    <View style={styles.ballDataCard}>
      <View style={styles.ballDataHeader}>
        <Text style={styles.ballDataTitle}>Ball {ball.ball_number}</Text>
        <View style={styles.ballDataTags}>
          {ball.length_type && <Tag label={ball.length_type.replace(/_/g, ' ')} color="#1a472a" />}
          {ball.line_type && <Tag label={ball.line_type.replace(/_/g, ' ')} color="#1565c0" />}
          {ball.delivery_type && <Tag label={ball.delivery_type.replace(/_/g, ' ')} color="#6a1b9a" />}
        </View>
      </View>
      <View style={styles.ballDataRow}>
        {ball.contact_type && (
          <View style={[styles.contactBadge, { backgroundColor: CONTACT_COLORS[ball.contact_type] || '#555' }]}>
            <Text style={styles.contactBadgeText}>{ball.contact_type.toUpperCase()}</Text>
          </View>
        )}
        {ball.shot_type && <Tag label={ball.shot_type} color="#555" />}
        {ball.is_wide && <Tag label="WIDE" color="#1565c0" />}
        {ball.is_no_ball && <Tag label="NO BALL" color="#c62828" />}
      </View>
      <TouchableOpacity style={styles.drsBtn} onPress={onDRSPress}>
        <Text style={styles.drsBtnText}>🔍 Run DRS Review</Text>
      </TouchableOpacity>
    </View>
  );
}

function Tag({ label, color }) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── DRS modal ────────────────────────────────────────────────────────────────
function DRSModal({ visible, ball, sessionId, onClose, onResult }) {
  const [step, setStep] = useState('pitch'); // pitch | impact | height | verdict
  const [pitchTap, setPitchTap] = useState(null);
  const [impactTap, setImpactTap] = useState(null);
  const [impactHeight, setImpactHeight] = useState(80);
  const [handedness, setHandedness] = useState('right');
  const [isWide, setIsWide] = useState(false);
  const [isFullToss, setIsFullToss] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep('pitch'); setPitchTap(null); setImpactTap(null);
    setImpactHeight(80); setResult(null); setIsWide(false); setIsFullToss(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleCalculate = async () => {
    if (!pitchTap || !impactTap) return;
    setLoading(true);
    try {
      const res = await submitLBWReview({
        ball_id: ball?.id || null,
        session_id: sessionId,
        pitchX: pitchTap.x, pitchY: pitchTap.y,
        impactX: impactTap.x, impactY: impactTap.y,
        impactHeightPct: impactHeight,
        batterHandedness: handedness,
        isWideReview: isWide,
        isFullToss,
      });
      setResult(res.data.data);
      setStep('verdict');
      onResult?.(res.data.data);
    } catch { Alert.alert('Error', 'Review failed'); }
    finally { setLoading(false); }
  };

  const vc = result ? VERDICT_COLORS[result.lbw?.verdict] || '#333' : '#333';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.drsModal}>
        <View style={styles.drsHeader}>
          <Text style={styles.drsTitle}>🔍 DRS — {ball ? `Ball ${ball.ball_number}` : 'New Review'}</Text>
          <TouchableOpacity onPress={handleClose}><Text style={styles.drsClose}>✕</Text></TouchableOpacity>
        </View>

        {/* Step tabs */}
        <View style={styles.stepTabs}>
          {['pitch', 'impact', 'height', 'verdict'].map((s, i) => (
            <TouchableOpacity key={s} style={[styles.stepTab, step === s && styles.stepTabActive]} onPress={() => result || s !== 'verdict' ? setStep(s) : null}>
              <Text style={[styles.stepTabText, step === s && styles.stepTabTextActive]}>{i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Handedness */}
          <View style={styles.drsRow}>
            <Text style={styles.drsLabel}>Batter:</Text>
            {['right', 'left'].map(h => (
              <TouchableOpacity key={h} style={[styles.handBtn, handedness === h && styles.handBtnActive]} onPress={() => setHandedness(h)}>
                <Text style={[styles.handBtnText, handedness === h && styles.handBtnTextActive]}>{h === 'right' ? 'RHB' : 'LHB'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Pitch tap */}
          {(step === 'pitch' || step === 'impact') && (
            <View style={styles.drsPitchWrap}>
              <Text style={styles.drsHint}>
                {step === 'pitch' ? '👆 Tap where the ball PITCHED' : '👆 Tap where the ball HIT the batter'}
              </Text>
              <PitchMap
                width={200}
                selectedPoint={step === 'pitch' ? pitchTap : impactTap}
                points={pitchTap && step === 'impact' ? [{ x: pitchTap.x, y: pitchTap.y, ball_number: 'P' }] : []}
                onTap={(pt) => {
                  if (step === 'pitch') { setPitchTap(pt); setStep('impact'); }
                  else { setImpactTap(pt); setStep('height'); }
                }}
              />
              {pitchTap && step === 'impact' && (
                <Text style={styles.tapNote}>P pitched at ({pitchTap.x}, {pitchTap.y})</Text>
              )}
            </View>
          )}

          {/* Height + toggles */}
          {step === 'height' && (
            <View style={styles.drsCard}>
              <Text style={styles.drsCardTitle}>Impact height</Text>
              <View style={styles.heightGrid}>
                {[
                  { label: 'Below knee', v: 30 }, { label: 'Knee roll', v: 55 },
                  { label: 'Mid-thigh', v: 75 }, { label: 'Top of stumps', v: 100 },
                  { label: 'Hip height', v: 140 }, { label: 'Above hip', v: 170 },
                ].map(h => (
                  <TouchableOpacity key={h.v} style={[styles.heightBtn, impactHeight === h.v && styles.heightBtnActive]} onPress={() => setImpactHeight(h.v)}>
                    <Text style={[styles.heightBtnText, impactHeight === h.v && styles.heightBtnTextActive]}>{h.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.togglesRow}>
                <TouchableOpacity style={[styles.toggleBtn, isWide && styles.toggleBtnActive]} onPress={() => setIsWide(!isWide)}>
                  <Text style={[styles.toggleBtnText, isWide && styles.toggleBtnTextActive]}>Wide review</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, isFullToss && styles.toggleBtnActive]} onPress={() => setIsFullToss(!isFullToss)}>
                  <Text style={[styles.toggleBtnText, isFullToss && styles.toggleBtnTextActive]}>Height no-ball</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={[styles.verdictBtn, (!pitchTap || !impactTap) && styles.verdictBtnDisabled]} onPress={handleCalculate} disabled={!pitchTap || !impactTap || loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.verdictBtnText}>▶ Get Verdict</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Verdict */}
          {step === 'verdict' && result && (
            <View style={styles.drsCard}>
              <View style={[styles.verdictBox, { borderColor: vc }]}>
                <Text style={[styles.verdictText, { color: vc }]}>{result.lbw?.verdict}</Text>
                <Text style={styles.verdictReason}>{result.lbw?.verdict_reason}</Text>
              </View>
              <View style={styles.checkList}>
                {[
                  { label: 'Pitched in line', ok: result.lbw?.pitched_in_line, bad: result.lbw?.pitched_outside_leg, badText: 'Outside leg stump' },
                  { label: 'Impact in line', ok: result.lbw?.impact_in_line },
                  { label: `Hitting stumps${result.lbw?.hitting_zone === 'umpires_call' ? " (Umpire's call)" : ''}`, ok: result.lbw?.hitting_stumps },
                ].map((c, i) => (
                  <View key={i} style={styles.checkRow}>
                    <Text style={{ color: c.bad ? '#c62828' : c.ok ? '#2e7d32' : '#c62828', fontSize: 18, width: 28 }}>{c.bad || !c.ok ? '✗' : '✓'}</Text>
                    <Text style={{ color: c.bad ? '#c62828' : c.ok ? '#2e7d32' : '#c62828', fontSize: 14 }}>{c.bad ? c.badText : c.label}</Text>
                  </View>
                ))}
              </View>
              {result.wide && (
                <View style={styles.extraBox}>
                  <Text style={styles.extraTitle}>Wide: <Text style={{ color: result.wide.verdict === 'WIDE' ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>{result.wide.verdict}</Text></Text>
                  <Text style={styles.extraReason}>{result.wide.reason}</Text>
                </View>
              )}
              {result.height_no_ball && (
                <View style={styles.extraBox}>
                  <Text style={styles.extraTitle}>Height no-ball: <Text style={{ color: result.height_no_ball.verdict === 'NO_BALL' ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>{result.height_no_ball.verdict}</Text></Text>
                  <Text style={styles.extraReason}>{result.height_no_ball.reason}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.resetBtn} onPress={reset}>
                <Text style={styles.resetBtnText}>↺ Review again</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main VideoTagger ─────────────────────────────────────────────────────────
export default function VideoTagger({ video, balls, sessionId }) {
  const [clips, setClips] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [taggingBall, setTaggingBall] = useState(null); // ball being tagged
  const [tagStart, setTagStart] = useState(null);
  const [selectedClip, setSelectedClip] = useState(null); // clip+ball currently highlighted
  const [drsTarget, setDrsTarget] = useState(null);
  const [drsVisible, setDrsVisible] = useState(false);
  const [loadingClips, setLoadingClips] = useState(true);

  const videoSource = { uri: `http://192.168.1.100:3001/uploads/${video.filename}` };

  const player = useVideoPlayer(videoSource, p => {
    p.loop = false;
    p.muted = false;
  });

  // Poll current time
  useEffect(() => {
    const interval = setInterval(() => {
      if (player) {
        setCurrentTime(player.currentTime || 0);
        setDuration(player.duration || 0);
        setIsPlaying(!player.paused);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [player]);

  useEffect(() => { loadClips(); }, [video.id]);

  const loadClips = async () => {
    setLoadingClips(true);
    try {
      const res = await getClipsForVideo(video.id);
      setClips(res.data.data);
    } catch { setClips([]); }
    finally { setLoadingClips(false); }
  };

  const seekTo = useCallback((time) => {
    if (player) { player.currentTime = time; }
  }, [player]);

  const togglePlay = () => {
    if (player.paused) player.play();
    else player.pause();
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Tagging flow
  const startTagging = (ball) => {
    setTaggingBall(ball);
    setTagStart(null);
    Alert.alert('Tag ball', `Tagging Ball ${ball.ball_number}.\n\nPlay the video to the start of this delivery, then tap "Mark Start".`);
  };

  const markStart = () => {
    setTagStart(currentTime);
    Alert.alert('Start marked', `Start: ${formatTime(currentTime)}\n\nNow advance to the end of the ball (after bat/pad contact) and tap "Mark End".`);
  };

  const markEnd = async () => {
    if (tagStart === null) { Alert.alert('No start', 'Mark the start first'); return; }
    if (currentTime <= tagStart) { Alert.alert('Invalid', 'End must be after start'); return; }
    try {
      await saveClip({
        ball_id: taggingBall.id,
        video_id: video.id,
        start_time: tagStart,
        end_time: currentTime,
      });
      await loadClips();
      setTaggingBall(null);
      setTagStart(null);
      Alert.alert('✅ Tagged', `Ball ${taggingBall.ball_number} tagged: ${formatTime(tagStart)} → ${formatTime(currentTime)}`);
    } catch { Alert.alert('Error', 'Could not save clip'); }
  };

  const cancelTagging = () => { setTaggingBall(null); setTagStart(null); };

  const jumpToClip = (clip) => {
    seekTo(clip.start_time);
    setSelectedClip(clip);
    if (player.paused) player.play();
    // Auto-pause at end_time
    const checkEnd = setInterval(() => {
      if (player.currentTime >= clip.end_time) {
        player.pause();
        clearInterval(checkEnd);
      }
    }, 100);
  };

  const handleDeleteClip = (clip) => {
    Alert.alert('Remove tag', `Remove tag for Ball ${clip.ball_number}?`, [
      { text: 'Cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await deleteClip(clip.id);
        loadClips();
        if (selectedClip?.id === clip.id) setSelectedClip(null);
      }},
    ]);
  };

  const taggedBallIds = new Set(clips.map(c => c.ball_id));

  return (
    <View style={styles.container}>
      {/* Video player */}
      <View style={styles.videoWrap}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
        />
        {/* Custom controls overlay */}
        <View style={styles.videoControls}>
          <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
            <Text style={styles.playBtnText}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <Text style={styles.timeText}>{formatTime(currentTime)} / {formatTime(duration)}</Text>
        </View>
      </View>

      {/* Scrub bar */}
      <View style={styles.scrubWrap}>
        <ScrubBar
          duration={duration}
          currentTime={currentTime}
          clips={clips}
          onSeek={seekTo}
        />
      </View>

      {/* Tagging controls */}
      {taggingBall && (
        <View style={styles.taggingBar}>
          <Text style={styles.taggingText}>Tagging Ball {taggingBall.ball_number}</Text>
          <View style={styles.taggingBtns}>
            <TouchableOpacity style={[styles.markBtn, tagStart !== null && styles.markBtnDone]} onPress={markStart}>
              <Text style={styles.markBtnText}>{tagStart !== null ? `✓ ${formatTime(tagStart)}` : 'Mark Start'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.markBtn, styles.markBtnEnd]} onPress={markEnd} disabled={tagStart === null}>
              <Text style={styles.markBtnText}>Mark End</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelTagBtn} onPress={cancelTagging}>
              <Text style={styles.cancelTagText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Selected ball data */}
      {selectedClip && (
        <BallDataCard
          ball={selectedClip}
          onDRSPress={() => {
            const matchedBall = balls.find(b => b.id === selectedClip.ball_id) || selectedClip;
            setDrsTarget(matchedBall);
            setDrsVisible(true);
          }}
        />
      )}

      {/* Pitch map for selected ball */}
      {selectedClip && selectedClip.pitch_x != null && (
        <View style={styles.miniDataRow}>
          <View style={styles.miniDataPanel}>
            <Text style={styles.miniDataTitle}>Pitch landing</Text>
            <PitchMap
              width={120}
              points={[{ x: parseFloat(selectedClip.pitch_x), y: parseFloat(selectedClip.pitch_y), length_type: selectedClip.length_type, ball_number: selectedClip.ball_number }]}
              highlightPoint={selectedClip.ball_number}
            />
          </View>
          <View style={styles.miniDataPanel}>
            <Text style={styles.miniDataTitle}>Ball details</Text>
            <View style={styles.miniStatList}>
              {[
                ['Length', selectedClip.length_type],
                ['Line', selectedClip.line_type],
                ['Delivery', selectedClip.delivery_type],
                ['Contact', selectedClip.contact_type],
                ['Shot', selectedClip.shot_type],
              ].filter(([, v]) => v).map(([k, v]) => (
                <View key={k} style={styles.miniStat}>
                  <Text style={styles.miniStatKey}>{k}</Text>
                  <Text style={styles.miniStatVal}>{v?.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Ball list */}
      <View style={styles.ballListHeader}>
        <Text style={styles.ballListTitle}>Balls ({balls.length})</Text>
        {loadingClips && <ActivityIndicator size="small" color="#1a472a" />}
      </View>

      <ScrollView style={styles.ballList} contentContainerStyle={{ paddingBottom: 20 }}>
        {balls.map(ball => {
          const clip = clips.find(c => c.ball_id === ball.id);
          const isSelected = selectedClip?.ball_id === ball.id;
          return (
            <View key={ball.id} style={[styles.ballRow, isSelected && styles.ballRowSelected]}>
              <TouchableOpacity
                style={styles.ballRowLeft}
                onPress={() => clip ? jumpToClip(clip) : null}
                disabled={!clip}
              >
                <View style={[styles.ballNumBadge, clip ? styles.ballNumBadgeTagged : {}]}>
                  <Text style={styles.ballNumText}>{ball.ball_number}</Text>
                </View>
                <View style={styles.ballRowInfo}>
                  <Text style={styles.ballRowMain}>
                    {ball.length_type?.replace(/_/g, ' ') || '?'} · {ball.line_type?.replace(/_/g, ' ') || '?'}
                  </Text>
                  <Text style={styles.ballRowSub}>
                    {ball.delivery_type?.replace(/_/g, ' ') || '?'}
                    {ball.contact_type ? ` · ${ball.contact_type}` : ''}
                    {ball.is_wide ? ' · WIDE' : ''}
                    {ball.is_no_ball ? ' · NO BALL' : ''}
                  </Text>
                  {clip && (
                    <Text style={styles.ballRowClip}>
                      🎬 {formatTime(clip.start_time)} → {formatTime(clip.end_time)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              <View style={styles.ballRowActions}>
                {clip ? (
                  <TouchableOpacity style={styles.taggedBtn} onPress={() => handleDeleteClip(clip)}>
                    <Text style={styles.taggedBtnText}>✓ Tagged</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.tagBtn} onPress={() => startTagging(ball)} disabled={!!taggingBall}>
                    <Text style={styles.tagBtnText}>Tag</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* DRS Modal */}
      <DRSModal
        visible={drsVisible}
        ball={drsTarget}
        sessionId={sessionId}
        onClose={() => setDrsVisible(false)}
        onResult={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  videoWrap: { width: SW, height: VIDEO_H, backgroundColor: '#000', position: 'relative' },
  video: { width: '100%', height: '100%' },
  videoControls: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, gap: 10 },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  playBtnText: { color: '#fff', fontSize: 16 },
  timeText: { color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'] },
  scrubWrap: { backgroundColor: '#1a1a1a', paddingHorizontal: 16, paddingVertical: 10 },
  scrubBar: { height: 24, justifyContent: 'center', position: 'relative' },
  scrubTrack: { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: '#444', borderRadius: 2 },
  clipMarker: { position: 'absolute', height: 10, top: 7, backgroundColor: '#f0c040', borderRadius: 2, opacity: 0.85 },
  playhead: { position: 'absolute', width: 3, height: 24, top: 0, backgroundColor: '#fff', borderRadius: 2, marginLeft: -1.5 },
  taggingBar: { backgroundColor: '#1a472a', padding: 12 },
  taggingText: { color: '#f0c040', fontWeight: 'bold', fontSize: 13, marginBottom: 8 },
  taggingBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  markBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#2d6a3f', borderWidth: 1, borderColor: '#4a8f3a' },
  markBtnDone: { backgroundColor: '#388e3c', borderColor: '#66bb6a' },
  markBtnEnd: { backgroundColor: '#c62828', borderColor: '#ef9a9a' },
  markBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  cancelTagBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  cancelTagText: { color: '#fff', fontWeight: 'bold' },
  ballDataCard: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  ballDataHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  ballDataTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a472a' },
  ballDataTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1, justifyContent: 'flex-end' },
  ballDataRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  contactBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  contactBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: '500' },
  drsBtn: { backgroundColor: '#1a472a', padding: 10, borderRadius: 8, alignItems: 'center' },
  drsBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  miniDataRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 10, marginBottom: 4 },
  miniDataPanel: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10 },
  miniDataTitle: { fontSize: 12, fontWeight: 'bold', color: '#1a472a', marginBottom: 6 },
  miniStatList: { gap: 4 },
  miniStat: { flexDirection: 'row', justifyContent: 'space-between' },
  miniStatKey: { fontSize: 11, color: '#888' },
  miniStatVal: { fontSize: 11, color: '#333', fontWeight: '500', textTransform: 'capitalize' },
  ballListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  ballListTitle: { fontSize: 14, fontWeight: 'bold', color: '#1a472a' },
  ballList: { flex: 1 },
  ballRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 6, borderRadius: 10, padding: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  ballRowSelected: { backgroundColor: '#e8f5e9', borderWidth: 1.5, borderColor: '#1a472a' },
  ballRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ballNumBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  ballNumBadgeTagged: { backgroundColor: '#1a472a' },
  ballNumText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  ballRowInfo: { flex: 1 },
  ballRowMain: { fontSize: 13, fontWeight: '600', color: '#333', textTransform: 'capitalize' },
  ballRowSub: { fontSize: 11, color: '#888', marginTop: 1, textTransform: 'capitalize' },
  ballRowClip: { fontSize: 11, color: '#1a472a', marginTop: 2, fontWeight: '500' },
  ballRowActions: { marginLeft: 8 },
  tagBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#1a472a' },
  tagBtnText: { color: '#1a472a', fontWeight: 'bold', fontSize: 12 },
  taggedBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1a472a' },
  taggedBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  drsModal: { flex: 1, backgroundColor: '#f0f4f0' },
  drsHeader: { backgroundColor: '#1a472a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50 },
  drsTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  drsClose: { color: '#fff', fontSize: 22, fontWeight: 'bold', padding: 4 },
  stepTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  stepTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  stepTabActive: { borderBottomColor: '#1a472a' },
  stepTabText: { fontSize: 11, color: '#888' },
  stepTabTextActive: { color: '#1a472a', fontWeight: 'bold' },
  drsRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
  drsLabel: { fontSize: 14, color: '#444', fontWeight: '600' },
  handBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff' },
  handBtnActive: { backgroundColor: '#1a472a', borderColor: '#1a472a' },
  handBtnText: { fontSize: 13, color: '#444' },
  handBtnTextActive: { color: '#fff', fontWeight: '600' },
  drsPitchWrap: { alignItems: 'center', padding: 16 },
  drsHint: { fontSize: 13, color: '#666', marginBottom: 12, textAlign: 'center', fontStyle: 'italic' },
  tapNote: { fontSize: 11, color: '#1a472a', marginTop: 6 },
  drsCard: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16 },
  drsCardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a472a', marginBottom: 12 },
  heightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  heightBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fafafa' },
  heightBtnActive: { backgroundColor: '#1a472a', borderColor: '#1a472a' },
  heightBtnText: { fontSize: 13, color: '#444' },
  heightBtnTextActive: { color: '#fff', fontWeight: '600' },
  togglesRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', backgroundColor: '#fafafa' },
  toggleBtnActive: { backgroundColor: '#c62828', borderColor: '#c62828' },
  toggleBtnText: { fontSize: 12, color: '#555', fontWeight: '500' },
  toggleBtnTextActive: { color: '#fff', fontWeight: 'bold' },
  verdictBtn: { backgroundColor: '#1a472a', padding: 14, borderRadius: 10, alignItems: 'center' },
  verdictBtnDisabled: { backgroundColor: '#aaa' },
  verdictBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  verdictBox: { borderWidth: 3, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 16 },
  verdictText: { fontSize: 36, fontWeight: 'bold', letterSpacing: 2 },
  verdictReason: { fontSize: 13, color: '#555', textAlign: 'center', marginTop: 6 },
  checkList: { marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  extraBox: { backgroundColor: '#f8f8f8', borderRadius: 8, padding: 12, marginBottom: 8 },
  extraTitle: { fontSize: 13, color: '#444', fontWeight: '600' },
  extraReason: { fontSize: 12, color: '#888', marginTop: 2 },
  resetBtn: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#1a472a' },
  resetBtnText: { color: '#1a472a', fontWeight: '600' },
});