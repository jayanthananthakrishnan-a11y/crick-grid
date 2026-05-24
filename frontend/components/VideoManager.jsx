import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uploadVideo, getVideosForSession, deleteVideo, SERVER_URL } from '../services/api';

export default function VideoManager({ sessionId, onVideoSelect }) {
  const [videos, setVideos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadingVideos, setLoadingVideos] = useState(false);

  React.useEffect(() => {
    loadVideos();
  }, [sessionId]);

  const loadVideos = async () => {
    if (!sessionId) return;
    setLoadingVideos(true);
    try {
      const res = await getVideosForSession(sessionId);
      setVideos(res.data.data);
    } catch {
      // No videos yet
    } finally {
      setLoadingVideos(false);
    }
  };

  const handlePickVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets[0];

      Alert.alert(
        'Upload video',
        `Upload "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)?`,
        [
          { text: 'Cancel' },
          { text: 'Upload', onPress: () => doUpload(file) },
        ]
      );
    } catch (e) {
      Alert.alert('Error', 'Could not pick video');
    }
  };

  const doUpload = async (file) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('session_id', String(sessionId));
      formData.append('video', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'video/mp4',
      });

      await uploadVideo(formData, (progressEvent) => {
        const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        setUploadProgress(pct);
      });

      await loadVideos();
      Alert.alert('✅ Uploaded', 'Video uploaded successfully');
    } catch (e) {
      Alert.alert('Upload failed', e.message || 'Could not upload video');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = (video) => {
    Alert.alert('Delete video', `Delete "${video.original_name}"?`, [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteVideo(video.id);
          loadVideos();
        }
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🎬 Videos</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={handlePickVideo} disabled={uploading}>
          {uploading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.uploadBtnText}>+ Upload</Text>
          }
        </TouchableOpacity>
      </View>

      {uploading && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          <Text style={styles.progressText}>{uploadProgress}%</Text>
        </View>
      )}

      {loadingVideos && <ActivityIndicator size="small" color="#1a472a" style={{ marginTop: 8 }} />}

      {videos.length === 0 && !loadingVideos && !uploading && (
        <Text style={styles.empty}>No videos uploaded yet. Upload a session recording to enable DRS review.</Text>
      )}

      {videos.map(v => (
        <View key={v.id} style={styles.videoCard}>
          <View style={styles.videoInfo}>
            <Text style={styles.videoName} numberOfLines={1}>{v.original_name}</Text>
            <Text style={styles.videoMeta}>
              {v.file_size_mb} MB · {new Date(v.uploaded_at).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.videoBtns}>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => onVideoSelect?.(v)}
            >
              <Text style={styles.selectBtnText}>Review</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(v)}>
              <Text style={styles.deleteBtn}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1a472a' },
  uploadBtn: { backgroundColor: '#1a472a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  uploadBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  progressBar: { height: 20, backgroundColor: '#e8f5e9', borderRadius: 10, overflow: 'hidden', marginBottom: 8, justifyContent: 'center' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#1a472a', borderRadius: 10 },
  progressText: { textAlign: 'center', fontSize: 11, color: '#1a472a', fontWeight: 'bold', zIndex: 1 },
  empty: { color: '#aaa', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  videoCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  videoInfo: { flex: 1 },
  videoName: { fontSize: 14, fontWeight: '600', color: '#333' },
  videoMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  videoBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectBtn: { backgroundColor: '#e8f5e9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#1a472a' },
  selectBtnText: { color: '#1a472a', fontSize: 13, fontWeight: '600' },
  deleteBtn: { fontSize: 18 },
});