import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageEmbedder, FilesetResolver } from '@mediapipe/tasks-vision';
import { Upload, Camera } from 'lucide-react';

const WebcamSimilarity = () => {
  const [imageEmbedder, setImageEmbedder] = useState(null);
  const [uploadedImageEmbedding, setUploadedImageEmbedding] = useState(null);
  const [similarity, setSimilarity] = useState(null);
  const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [runningMode, setRunningMode] = useState('IMAGE');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const webcamRef = useRef(null);
  const uploadedImageRef = useRef(null);
  const animationRef = useRef(null);

  // Get base URL for assets
  const getBaseUrl = () => {
    const isDev = import.meta.env.DEV;
    if (isDev) {
      // Development - use current origin (e.g., http://localhost:5173)
      return window.location.origin;
    } else {
      // Production - use BASE_URL if configured, otherwise use current origin
      return import.meta.env.BASE_URL ?
        new URL(import.meta.env.BASE_URL, window.location.origin).toString() :
        window.location.origin;
    }
  };

  // Initialize MediaPipe Image Embedder
  useEffect(() => {
    const initializeEmbedder = async () => {
      try {
        setIsLoading(true);
        setError('');

        const baseUrl = getBaseUrl();
        console.log('Initializing with base URL:', baseUrl);

        const vision = await FilesetResolver.forVisionTasks(
          `${baseUrl}/node_modules/@mediapipe/tasks-vision/wasm`
        );

        const embedder = await ImageEmbedder.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `${baseUrl}/mobilenet_v3_small.tflite`
          },
          runningMode: "IMAGE"
        });

        setImageEmbedder(embedder);
      } catch (error) {
        console.error('Error initializing embedder:', error);
        setError('Failed to initialize image embedder. Please check console for details.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeEmbedder();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (file && imageEmbedder) {
      setIsLoading(true);
      setError('');
      try {
        const url = URL.createObjectURL(file);
        setUploadedImageUrl(url);

        // Switch to IMAGE mode if needed
        if (runningMode !== 'IMAGE') {
          setRunningMode('IMAGE');
          await imageEmbedder.setOptions({ runningMode: 'IMAGE' });
        }

        // Wait for image to load before getting embedding
        const img = new Image();
        img.src = url;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const result = await imageEmbedder.embed(img);
        setUploadedImageEmbedding(result.embeddings[0]);
      } catch (error) {
        console.error('Error processing uploaded image:', error);
        setError('Failed to process uploaded image. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const enableWebcam = async () => {
    if (!imageEmbedder) {
      setError('Image embedder not initialized');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Switch to VIDEO mode
      if (runningMode !== 'VIDEO') {
        setRunningMode('VIDEO');
        await imageEmbedder.setOptions({ runningMode: 'VIDEO' });
      }
      setIsWebcamEnabled(true);
    } catch (error) {
      console.error('Error enabling webcam:', error);
      setError('Failed to enable webcam. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const predictWebcam = async () => {
    if (!webcamRef.current?.video || !imageEmbedder || !uploadedImageEmbedding) {
      return;
    }

    try {
      // Ensure video is actually playing and ready
      if (webcamRef.current.video.readyState !== 4) {
        animationRef.current = requestAnimationFrame(predictWebcam);
        return;
      }

      const startTimeMs = performance.now();
      const embedderResult = await imageEmbedder.embedForVideo(
        webcamRef.current.video,
        startTimeMs
      );

      if (embedderResult?.embeddings?.[0]) {
        const similarity = ImageEmbedder.cosineSimilarity(
          uploadedImageEmbedding,
          embedderResult.embeddings[0]
        );
        setSimilarity(similarity);
      }
    } catch (error) {
      console.error('Error in predictWebcam:', error);
      // Don't immediately retry on error
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Schedule next frame if still enabled
    if (isWebcamEnabled) {
      animationRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  // Start/stop prediction loop when webcam is enabled/disabled
  useEffect(() => {
    let isActive = false;

    const startPrediction = async () => {
      if (isWebcamEnabled && imageEmbedder && uploadedImageEmbedding) {
        isActive = true;
        while (isActive) {
          await predictWebcam();
          // Add small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    };

    startPrediction();

    return () => {
      isActive = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isWebcamEnabled, imageEmbedder, uploadedImageEmbedding]);

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Webcam Similarity Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
              <p>{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Reference Image</h3>
              {uploadedImageUrl ? (
                <img
                  src={uploadedImageUrl}
                  alt="Uploaded reference"
                  className="w-full h-48 object-cover rounded-lg"
                  ref={uploadedImageRef}
                />
              ) : (
                <div className="w-full h-48 bg-muted flex items-center justify-center rounded-lg">
                  <p className="text-muted-foreground">No image uploaded</p>
                </div>
              )}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById('fileInput').click()}
                  disabled={isLoading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isLoading ? 'Processing...' : 'Upload Image'}
                </Button>
                <input
                  id="fileInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-medium">Webcam Feed</h3>
              {isWebcamEnabled ? (
                <Webcam
                  ref={webcamRef}
                  className="w-full h-48 object-cover rounded-lg"
                  mirrored
                />
              ) : (
                <div className="w-full h-48 bg-muted flex items-center justify-center rounded-lg">
                  <p className="text-muted-foreground">Webcam not enabled</p>
                </div>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={enableWebcam}
                disabled={isWebcamEnabled || !uploadedImageEmbedding || isLoading}
              >
                <Camera className="mr-2 h-4 w-4" />
                {isLoading ? 'Initializing...' : 'Enable Webcam'}
              </Button>
            </div>
          </div>

          {similarity !== null && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-center text-lg">
                Similarity Score: {similarity.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WebcamSimilarity;