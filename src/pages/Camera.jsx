import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { storage, db } from '../firebaseConfig';

const RED = 'rgb(186, 73, 73)';

export default function Camera() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [capturedImage, setCapturedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [zoom, setZoom] = useState(0);
  const cameraRef = useRef(null);

  // Automatically request permission when component mounts
  useEffect(() => {
    if (permission && !permission.granted && !hasRequestedPermission) {
      setHasRequestedPermission(true);
      // Small delay to ensure UI is ready
      setTimeout(() => {
        requestPermission();
      }, 500);
    }
  }, [permission, hasRequestedPermission, requestPermission]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Loading Camera...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>📷 Camera Access Needed</Text>
          <Text style={styles.subtitle}>
            PillPal needs camera access to scan and identify pills.{'\n\n'}
            A permission popup should appear automatically. If not, tap the button below.
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Allow Camera Access</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>
            If the popup doesn't appear, check your device settings for camera permissions.
          </Text>
        </View>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        setCapturedImage(photo.uri);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const retakePicture = () => {
    setCapturedImage(null);
  };

  const analyzePicture = async () => {
    if (!capturedImage || !user) return;
    
    setIsAnalyzing(true);
    try {
      // Step 1: Upload image to Firebase Storage
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      const imageRef = ref(storage, `pills/${user.uid}/${Date.now()}.jpg`);
      const uploadResult = await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      console.log('Image uploaded to Storage:', downloadURL);
      
      // Step 2: Save metadata to Firestore
      const pillId = `pill_${Date.now()}`;
      await setDoc(doc(db, 'pills', pillId), {
        id: pillId,
        userId: user.uid,
        imageUrl: downloadURL,
        storagePath: uploadResult.ref.fullPath,
        createdAt: serverTimestamp(),
        status: 'pending_analysis',
        analysisResult: null,
      });
      
      console.log('Pill metadata saved to Firestore:', pillId);
      
      // Step 3: Call Firebase Function for analysis
      const functionUrl = 'https://us-central1-pillpal-11778.cloudfunctions.net/analyzePill';
      
      const analysisResponse = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pillId: pillId,
          imageUrl: downloadURL,
          userId: user.uid,
        }),
      });
      
      if (!analysisResponse.ok) {
        throw new Error(`API call failed: ${analysisResponse.status}`);
      }
      
      const analysisResult = await analysisResponse.json();
      console.log('Analysis result:', analysisResult);
      
      // Step 4: Update Firestore with analysis result
      await setDoc(doc(db, 'pills', pillId), {
        status: 'analyzed',
        analysisResult: analysisResult,
        analyzedAt: serverTimestamp(),
      }, { merge: true });
      
      Alert.alert(
        'Analysis Complete!',
        `Pill analysis completed successfully!\n\nResult: ${analysisResult.result || 'Analysis completed'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setCapturedImage(null);
              setIsAnalyzing(false);
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error analyzing picture:', error);
      Alert.alert(
        'Analysis Failed', 
        `Failed to analyze picture: ${error.message}\n\nPlease try again.`
      );
      setIsAnalyzing(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const adjustZoom = (direction) => {
    if (direction === 'in' && zoom < 1) {
      setZoom(prev => Math.min(prev + 0.1, 1));
    } else if (direction === 'out' && zoom > 0) {
      setZoom(prev => Math.max(prev - 0.1, 0));
    }
  };

  if (capturedImage) {
    return (
      <View style={styles.container}>
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          <View style={styles.previewOverlay}>
            <Text style={styles.previewTitle}>Photo Captured</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.retakeButton]} 
                onPress={retakePicture}
                disabled={isAnalyzing}
              >
                <Text style={[styles.buttonText, styles.retakeButtonText]}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.analyzeButton]} 
                onPress={analyzePicture}
                disabled={isAnalyzing}
              >
                <Text style={styles.buttonText}>
                  {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        ref={cameraRef}
        zoom={zoom}
      >
        <View style={styles.cameraOverlay}>
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
              <Text style={styles.flipButtonText}>Flip</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.zoomControls}>
            <TouchableOpacity 
              style={styles.zoomButton} 
              onPress={() => adjustZoom('out')}
              disabled={zoom <= 0}
            >
              <Text style={styles.zoomButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
            <TouchableOpacity 
              style={styles.zoomButton} 
              onPress={() => adjustZoom('in')}
              disabled={zoom >= 1}
            >
              <Text style={styles.zoomButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 60,
  },
  flipButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  flipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  zoomButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  zoomButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  zoomText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 15,
    minWidth: 40,
    textAlign: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 30,
    paddingBottom: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
    width: '100%',
    resizeMode: 'contain',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
    paddingBottom: 40,
  },
  previewTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  retakeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: '#fff',
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  analyzeButton: {
    backgroundColor: RED,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  title: {
    color: RED,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    color: 'rgba(0,0,0,0.7)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  helpText: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});


