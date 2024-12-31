import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FaceDetector, FilesetResolver, ImageEmbedder } from "@mediapipe/tasks-vision";
import { Camera, Upload } from "lucide-react";
import { ImageProcessor } from "@/core/image-processor";
import { cn } from "@/lib/utils";

interface FaceRecognizerProps {
  onRecognitionComplete?: () => void;
  similarityThreshold?: number;
}

const FaceRecognizer: React.FC<FaceRecognizerProps> = ({
                                                         onRecognitionComplete,
                                                         similarityThreshold = 0.8 // 80% similarity threshold by default
                                                       }) => {
  const [imageEmbedder, setImageEmbedder] = useState<any>(null);
  const [faceDetector, setFaceDetector] = useState<any>(null);
  const [uploadedImageEmbedding, setUploadedImageEmbedding] = useState<any>(null);
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [runningMode, setRunningMode] = useState("IMAGE");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [stableMatchStartTime, setStableMatchStartTime] = useState<number | null>(null);
  const [verificationProgress, setVerificationProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadedImageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadedImageCanvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const streamRef = useRef<MediaStream | null>(null);

  const REQUIRED_STABLE_TIME = 3000; // 3 seconds of stable matching required

  const getBaseUrl = () => {
    const isDev = import.meta.env.DEV;
    return isDev ? window.location.origin :
      import.meta.env.BASE_URL ?
        new URL(import.meta.env.BASE_URL, window.location.origin).toString() :
        window.location.origin;
  };

  // Initialize MediaPipe Face Detector and Image Embedder
  useEffect(() => {
    const initializeModels = async () => {
      try {
        setIsLoading(true);
        setError("");

        const baseUrl = getBaseUrl();
        const vision = await FilesetResolver.forVisionTasks(
          `${baseUrl}/node_modules/@mediapipe/tasks-vision/wasm`
        );

        // Initialize face detector
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `${baseUrl}/blaze_face_short_range.tflite`,
            delegate: "GPU"
          },
          runningMode: "IMAGE"
        });

        // Initialize image embedder
        const embedder = await ImageEmbedder.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `${baseUrl}/mobilenet_v3_large.tflite`
          },
          runningMode: "IMAGE"
        });

        setFaceDetector(detector);
        setImageEmbedder(embedder);
      } catch (error) {
        console.error("Error initializing models:", error);
        setError("Failed to initialize models. Please check console for details.");
      } finally {
        setIsLoading(false);
      }
    };

    initializeModels();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Effect for delayed verification
  useEffect(() => {
    if (similarity !== null && similarity >= similarityThreshold && !isVerified) {
      const currentTime = Date.now();

      if (!stableMatchStartTime) {
        // Start counting stable time
        setStableMatchStartTime(currentTime);
      } else {
        // Calculate how long we've had a stable match
        const stableTime = currentTime - stableMatchStartTime;
        const progress = Math.min((stableTime / REQUIRED_STABLE_TIME) * 100, 100);
        setVerificationProgress(progress);

        if (stableTime >= REQUIRED_STABLE_TIME) {
          setIsVerified(true);
          // Stop webcam when verification is complete
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          setIsWebcamEnabled(false);
          onRecognitionComplete?.();
        }
      }
    } else {
      // Reset stable match timer if similarity drops
      setStableMatchStartTime(null);
      setVerificationProgress(0);
    }
  }, [similarity, similarityThreshold, isVerified, onRecognitionComplete, stableMatchStartTime]);

  const displayImageDetections = (detections: any[], image: HTMLImageElement) => {
    const canvas = uploadedImageCanvasRef.current;
    const imageElement = uploadedImageRef.current;
    if (!canvas || !image || !imageElement) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get the container and image dimensions
    const containerRect = imageElement.parentElement!.getBoundingClientRect();
    const imageRect = imageElement.getBoundingClientRect();

    // Set canvas size to match the container
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;

    // Calculate the actual image position and scale within the container
    const imageScale = Math.min(
      imageRect.width / image.naturalWidth,
      imageRect.height / image.naturalHeight
    );

    // Calculate image position within container
    const scaledWidth = image.naturalWidth * imageScale;
    const scaledHeight = image.naturalHeight * imageScale;
    const imageX = (containerRect.width - scaledWidth) / 2;
    const imageY = (containerRect.height - scaledHeight) / 2;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach(detection => {
      const box = detection.boundingBox;

      // Calculate scaled and positioned coordinates
      const boxX = imageX + (box.originX * imageScale);
      const boxY = imageY + (box.originY * imageScale);
      const boxWidth = box.width * imageScale;
      const boxHeight = box.height * imageScale;

      ctx.strokeStyle = "#00FFFF";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      // Draw confidence text
      ctx.fillStyle = "#00FFFF";
      const fontSize = Math.max(16 * imageScale, 12);
      ctx.font = `${fontSize}px Arial`;
      const confidence = Math.round(detection.categories[0].score * 100);
      const text = `Confidence: ${confidence}%`;
      ctx.fillText(text, boxX, Math.max(boxY - 5, fontSize));

      // Draw keypoints if available
      if (detection.keypoints) {
        detection.keypoints.forEach((keypoint: any) => {
          const keypointX = imageX + (keypoint.x * imageRect.width);
          const keypointY = imageY + (keypoint.y * imageRect.height);

          ctx.beginPath();
          ctx.arc(keypointX, keypointY, 3, 0, 2 * Math.PI);
          ctx.fillStyle = "#FF0000";
          ctx.fill();
        });
      }
    });
  };

  const displayVideoDetections = (detections: any[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas size to video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale and translate for mirrored effect
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);

    detections.forEach(detection => {
      const box = detection.boundingBox;
      const padding = 20;

      // Draw bounding box
      ctx.strokeStyle = "#00FFFF";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        box.originX - padding,
        box.originY - padding,
        box.width + (padding * 2),
        box.height + (padding * 2)
      );

      // Draw confidence text - adjust x position for mirrored display
      ctx.fillStyle = "#00FFFF";
      ctx.font = "16px Arial";
      const confidence = Math.round(detection.categories[0].score * 100);
      const text = `Confidence: ${confidence}%`;
      // Flip text direction for mirrored display
      ctx.scale(-1, 1);
      ctx.fillText(
        text,
        -(box.originX - padding),
        box.originY - padding - 5
      );
      ctx.scale(-1, 1);

      // Draw keypoints if available
      if (detection.keypoints) {
        detection.keypoints.forEach((keypoint: any) => {
          ctx.beginPath();
          ctx.arc(
            keypoint.x * canvas.width,
            keypoint.y * canvas.height,
            3,
            0,
            2 * Math.PI
          );
          ctx.fillStyle = "#FF0000";
          ctx.fill();
        });
      }
    });

    ctx.restore();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && imageEmbedder && faceDetector) {
      setIsLoading(true);
      setError("");
      try {
        const url = URL.createObjectURL(file);
        setUploadedImageUrl(url);

        if (runningMode !== "IMAGE") {
          setRunningMode("IMAGE");
          await Promise.all([
            imageEmbedder.setOptions({ runningMode: "IMAGE" }),
            faceDetector.setOptions({ runningMode: "IMAGE" })
          ]);
        }

        const img = new Image();
        img.src = url;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const detections = await faceDetector.detect(img);
        if (!detections.detections?.length) {
          throw new Error("No face detected in the uploaded image");
        }

        displayImageDetections(detections.detections, img);

        // Process image with minimal preprocessing
        const processedFace = await ImageProcessor.processForEmbedding(img, detections.detections[0]);
        const result = await imageEmbedder.embed(processedFace);
        setUploadedImageEmbedding(result.embeddings[0]);

      } catch (error: any) {
        console.error("Error processing uploaded image:", error);
        setError(error.message || "Failed to process uploaded image. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const enableWebcam = async () => {
    if (!imageEmbedder || !faceDetector || !videoRef.current) {
      setError("Required elements not initialized");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      // Reset video element if it already has a stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      // Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      // Store stream reference
      streamRef.current = stream;

      // Set up video element
      const videoElement = videoRef.current;
      videoElement.srcObject = stream;
      videoElement.playsInline = true;

      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        const onLoadedMetadata = () => {
          videoElement.removeEventListener("loadedmetadata", onLoadedMetadata);
          resolve();
        };
        videoElement.addEventListener("loadedmetadata", onLoadedMetadata);
      });

      // Start playing
      await videoElement.play();

      if (runningMode !== "VIDEO") {
        setRunningMode("VIDEO");
        await Promise.all([
          imageEmbedder.setOptions({ runningMode: "VIDEO" }),
          faceDetector.setOptions({ runningMode: "VIDEO" })
        ]);
      }

      setIsWebcamEnabled(true);
    } catch (error: any) {
      console.error("Error enabling webcam:", error);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setError("Failed to enable webcam. Please ensure camera access is allowed and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const predictWebcam = async () => {
    if (!videoRef.current || !imageEmbedder || !faceDetector || !uploadedImageEmbedding || !processingCanvasRef.current || isVerified) {
      return;
    }

    try {
      const video = videoRef.current;

      // Ensure video is ready
      if (video.readyState !== 4) {
        animationRef.current = requestAnimationFrame(predictWebcam);
        return;
      }

      // Only process if frame has changed
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        const startTimeMs = performance.now();

        // Create unmirrored frame for processing
        const processingCanvas = processingCanvasRef.current;
        processingCanvas.width = video.videoWidth;
        processingCanvas.height = video.videoHeight;
        const processingCtx = processingCanvas.getContext("2d");
        if (!processingCtx) return;

        processingCtx.drawImage(video, 0, 0);

        // Detect faces using the unmirrored frame
        const detections = await faceDetector.detectForVideo(processingCanvas, startTimeMs);

        // Display detections on the mirrored canvas
        if (detections.detections) {
          displayVideoDetections(detections.detections);
        }

        if (detections.detections?.length) {
          // Process webcam frame with minimal preprocessing
          const processedFace = await ImageProcessor.processForEmbedding(processingCanvas, detections.detections[0]);
          const embedderResult = await imageEmbedder.embedForVideo(
            processedFace,
            startTimeMs
          );

          if (embedderResult?.embeddings?.[0]) {
            // Calculate similarity
            const similarity = ImageEmbedder.cosineSimilarity(
              uploadedImageEmbedding,
              embedderResult.embeddings[0]
            );
            setSimilarity(similarity);
          }
        }
      }
    } catch (error) {
      console.error("Error in predictWebcam:", error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (isWebcamEnabled) {
      animationRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  useEffect(() => {
    let isActive = true;

    const startPrediction = async () => {
      if (isWebcamEnabled && imageEmbedder && faceDetector && uploadedImageEmbedding) {
        while (isActive) {
          await predictWebcam();
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
  }, [isWebcamEnabled, imageEmbedder, faceDetector, uploadedImageEmbedding]);

  // Render similarity indicator with progress bar
  const renderSimilarityIndicator = () => {
    if (similarity === null) return null;

    const percentage = (similarity * 100).toFixed(1);
    return (
      <div className={cn(
        "mt-4 p-4 rounded-lg",
        isVerified ? "bg-green-500/10" : "bg-muted"
      )}>
        <div className="space-y-2">
          <p className="text-center text-lg">
            Similarity Score: {percentage}%
            {isVerified && " - Verification Complete!"}
          </p>

          {!isVerified && similarity >= similarityThreshold && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Verifying...</span>
                <span>{Math.round(verificationProgress)}%</span>
              </div>
              <div className="w-full bg-muted-foreground/20 rounded-full h-2">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${verificationProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-4">
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Reference Face</h3>
          <div className="relative h-[480px] bg-muted rounded-lg flex items-center justify-center overflow-hidden">
            {uploadedImageUrl ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={uploadedImageUrl}
                  alt="Uploaded reference"
                  className="max-h-full max-w-full object-contain"
                  ref={uploadedImageRef}
                  onLoad={async (e) => {
                    const target = e.target as HTMLImageElement;
                    if (uploadedImageRef.current && faceDetector) {
                      const result = await faceDetector.detect(target);
                      if (result.detections?.length) {
                        displayImageDetections(result.detections, target);
                      }
                    }
                  }}
                />
                <canvas
                  ref={uploadedImageCanvasRef}
                  className="absolute inset-0 pointer-events-none"
                />
              </div>
            ) : (
              <p className="text-muted-foreground">No image uploaded</p>
            )}
          </div>
          <div className="flex justify-center">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => document.getElementById("fileInput")?.click()}
              disabled={isLoading || isVerified}
            >
              <Upload className="mr-2 h-4 w-4" />
              {isLoading ? "Processing..." : "Upload Image"}
            </Button>
            <input
              id="fileInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isVerified}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium">Webcam Feed</h3>
          <div className="relative h-[480px] bg-muted rounded-lg flex items-center justify-center">
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-contain rounded-lg ${!isWebcamEnabled ? "hidden" : ""} scale-x-[-1]`}
              playsInline
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full ${!isWebcamEnabled ? "hidden" : ""}`}
              style={{ pointerEvents: "none" }}
            />
            <canvas
              ref={processingCanvasRef}
              className="hidden"
            />
            {!isWebcamEnabled && !isVerified && (
              <p className="text-muted-foreground">Webcam not enabled</p>
            )}
            {isVerified && (
              <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                <p className="text-xl font-bold text-green-500">Face Verified!</p>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={enableWebcam}
            disabled={isWebcamEnabled || !uploadedImageEmbedding || isLoading || isVerified}
          >
            <Camera className="mr-2 h-4 w-4" />
            {isLoading ? "Initializing..." : "Enable Webcam"}
          </Button>
        </div>
      </div>

      {renderSimilarityIndicator()}
    </div>
  );
};

export default FaceRecognizer;