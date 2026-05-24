import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSession } from '../context/SessionContext';
import { getBallsForSession, getVideosForSession, uploadVideo, deleteVideo } from '../services/api';
import VideoTagger from '../components/VideoTagger';
import SessionPicker from '../components/SessionPicker';

export default function ReviewScreen() {
  const { activeSession } = useSession();
  const [balls, setBalls] = useState([]);
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeSession) { setBalls([]); setVideos([]); setSelectedVideo(null); return; }
    loadSessionData(activeSession.id);
  }, [activeSession?.id]);

  const loadSessionData = async (sessionId) => {
    setLoading(true);
    try {
      const [ballsRes, videosRes] = await Promise.all([
        getBallsForSession(sessionId),
        getVideosForSession(sessionId),
      ]);
      setBalls(ballsRes.data.data);
      setVideos(videosRes.data.data);
    } catch {
      Alert.alert('Error', 'Could not load session data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];

      Alert.alert('Upload video', `Upload "${file.name}"?\n${(file.size / 1024 / 1024).toFixed(1)} MB`, [
        { text: 'Cancel' },
        {
          text: 'Upload', onPress: async () => {
            setUploading(true); setUploadProgress(0);
            try {
              const formData = new FormData();
              formData.append('session_id', String(activeSession.id));
              formData.append('video', { uri: file.uri, name: file.name, type: file.mimeType || 'video/mp4' });
              await uploadVideo(formData, e => setUploadProgress(Math.round((e.loaded / e.total) * 100)));
              await loadSessionData(activeSession.id);
              Alert.alert('✅ Uploaded', 'Tap the video to start tagging balls.');
            } catch (e) {
              Alert.alert('Upload failed', e.message);
            } finally {
              setUploading(false); setUploadProgress(0);
            }
          }
        },
      ]);
    } catch { Alert.alert('Error', 'Could not pick video'); }
  };

  const handleDeleteVideo = (v) => {
    Alert.alert('Delete video', `Delete "${v.original_name}"?`, [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteVideo(v.id);
          await loadSessionData(activeSession.id);
          if (selectedVideo?.id === v.id) setSelectedVideo(null);
        }
      },
    ]);
  };

  // Full-screen video tagger
  if (selectedVideo && activeSession) {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.taggerHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedVideo(null)}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.taggerTitle} numberOfLines={1}>{selectedVideo.original_name}</Text>
          <Text style={styles.taggerSession}>{activeSession.session_name}</Text>
        </View>
        <VideoTagger video={selectedVideo} balls={balls} sessionId={activeSession.id} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f0' }}>
      <SessionPicker />

      {!activeSession ? (
        <View style={styles.noSession}>
          <Text style={styles.noSessionIcon}>🎬</Text>
          <Text style={styles.noSessionTitle}>Select a session above</Text>
          <Text style={styles.noSessionSub}>Upload recordings and tag individual balls for DRS review</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator size="large" color="#1a472a" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={styles.sessionBanner}>
            <Text style={styles.sessionBannerText}>
              🎳 {activeSession.bowler_name}  →  🏏 {activeSession.batsman_name}
            </Text>
            <Text style={styles.sessionBannerSub}>{balls.length} balls logged</Text>
          </View>

          <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload} disabled={uploading}>
            {uploading
              ? <Text style={styles.uploadBtnText}>Uploading {uploadProgress}%...</Text>
              : <Text style={styles.uploadBtnText}>📤 Upload Video for This Session</Text>
            }
          </TouchableOpacity>

          {uploading && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
          )}

          {videos.length === 0 && !uploading && (
            <View style={styles.emptyVideos}>
              <Text style={styles.emptyIcon}>🎬</Text>
              <Text style={styles.emptyTitle}>No videos yet</Text>
              <Text style={styles.emptySub}>Upload a recording to tag balls and run DRS reviews</Text>
            </View>
          )}

          {videos.map(v => (
            <TouchableOpacity key={v.id} style={styles.videoCard} onPress={() => setSelectedVideo(v)}>
              <View style={styles.videoIcon}><Text style={{ fontSize: 28 }}>🎬</Text></View>
              <View style={styles.videoInfo}>
                <Text style={styles.videoName} numberOfLines={2}>{v.original_name}</Text>
                <Text style={styles.videoMeta}>{v.file_size_mb} MB · {new Date(v.uploaded_at).toLocaleDateString()}</Text>
                <Text style={styles.videoAction}>Tap to open and tag balls →</Text>
              </View>
              <TouchableOpacity style={styles.videoDelete} onPress={() => handleDeleteVideo(v)}>
                <Text style={{ fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          <View style={styles.howTo}>
            <Text style={styles.howToTitle}>How video tagging works</Text>
            {[
              '1. Upload a recording of your net session above',
              '2. Tap the video to open the tagger',
              '3. Find a delivery in the video, tap "Tag" on that ball number',
              '4. Tap "Mark Start" at the start of the delivery',
              '5. Tap "Mark End" after bat/pad contact',
              '6. Tap any tagged ball to jump to that moment in the video',
              '7. Tap "Run DRS Review" on any ball for LBW simulation',
            ].map((s, i) => <Text key={i} style={styles.howToStep}>{s}</Text>)}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  noSession: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  noSessionIcon: { fontSize: 48, marginBottom: 12 },
  noSessionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a472a', textAlign: 'center', marginBottom: 6 },
  noSessionSub: { fontSize: 13, color: '#888', textAlign: 'center' },
  sessionBanner: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginBottom: 14 },
  sessionBannerText: { color: '#1a472a', fontSize: 14, fontWeight: '600' },
  sessionBannerSub: { color: '#555', fontSize: 12, marginTop: 2 },
  uploadBtn: { backgroundColor: '#1a472a', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  uploadBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  progressBar: { height: 6, backgroundColor: '#e8f5e9', borderRadius: 3, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#1a472a', borderRadius: 3 },
  emptyVideos: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a472a', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center' },
  videoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  videoIcon: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  videoInfo: { flex: 1 },
  videoName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 3 },
  videoMeta: { fontSize: 11, color: '#888', marginBottom: 3 },
  videoAction: { fontSize: 11, color: '#1a472a', fontWeight: '600' },
  videoDelete: { padding: 8 },
  howTo: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 8 },
  howToTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a472a', marginBottom: 10 },
  howToStep: { fontSize: 13, color: '#555', marginBottom: 6, lineHeight: 20 },
  taggerHeader: { backgroundColor: '#1a472a', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' },
  backBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  taggerTitle: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  taggerSession: { color: '#a5d6a7', fontSize: 11 },
});