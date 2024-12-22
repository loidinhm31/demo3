import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const FaceLandmarkDetector = () => {
  const [faceLandmarker, setFaceLandmarker] = useState<any>(null);
  const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
  const [runningMode, setRunningMode] = useState("IMAGE");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [isFaceInBounds, setIsFaceInBounds] = useState(false);
  const [multipleFacesDetected, setMultipleFacesDetected] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const progressStartTimeRef = useRef<number | null>(null);

  const getBaseUrl = () => {
    const isDev = import.meta.env.DEV;
    return isDev ? window.location.origin :
      import.meta.env.BASE_URL ?
        new URL(import.meta.env.BASE_URL, window.location.origin).toString() :
        window.location.origin;
  };

  // Initialize MediaPipe Face Landmarker
  useEffect(() => {
    const initializeLandmarker = async () => {
      try {
        setIsLoading(true);
        setError("");

        const baseUrl = getBaseUrl();
        const vision = await FilesetResolver.forVisionTasks(
          `${baseUrl}/node_modules/@mediapipe/tasks-vision/wasm`
        );

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `${baseUrl}/face_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "IMAGE",
          outputFaceBlendshapes: true,
          numFaces: 2 // Keep this at 2 to detect multiple faces
        });

        setFaceLandmarker(landmarker);
      } catch (error) {
        console.error("Error initializing landmarker:", error);
        setError("Failed to initialize face detection. Please check console for details.");
      } finally {
        setIsLoading(false);
      }
    };

    initializeLandmarker();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const drawProgressOval = (ctx: CanvasRenderingContext2D, progress: number, isRed: boolean, faceCount?: number) => {
    const canvas = ctx.canvas;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radiusX = canvas.width * 0.15;
    const radiusY = canvas.height * 0.4;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background oval with shadow
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Draw dashed background oval in red
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = "#E0115F";
    ctx.lineWidth = 15;
    ctx.setLineDash([15, 10]);
    ctx.stroke();
    ctx.restore();

    // Draw red oval for multiple faces or face out of bounds
    if (isRed) {
      ctx.save();
      ctx.shadowColor = "#D22B2B";

      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
      ctx.strokeStyle = "#E0115F";
      ctx.lineWidth = 15;
      ctx.setLineDash([15, 10]);
      ctx.stroke();
      ctx.restore();

      // Add warning text for multiple faces
      if (faceCount && faceCount > 1) {
        ctx.font = "30px Arial";
        ctx.fillStyle = "#E0115F";
        ctx.textAlign = "center";
        ctx.fillText("Many faces detected", centerX, centerY - radiusY - 20);
      }
    } else if (progress > 0) {
      // Draw green progress with shadow
      ctx.save();
      ctx.shadowColor = "#355E3B";

      ctx.beginPath();
      ctx.ellipse(
        centerX,
        centerY,
        radiusX,
        radiusY,
        0,
        -Math.PI / 2,
        (progress * 2 * Math.PI) - Math.PI / 2
      );
      ctx.strokeStyle = "#50C878";
      ctx.lineWidth = 15;
      ctx.setLineDash([]); // Solid line for progress
      ctx.stroke();
      ctx.restore();
    }
  };

  const isFaceWithinOval = (landmarks: { x: number; y: number }[], canvas: HTMLCanvasElement) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radiusX = canvas.width * 0.15;
    const radiusY = canvas.height * 0.4;

    // Use points around the face oval for better detection
    const faceOvalPoints = landmarks.slice(0, 36); // First 36 points define face oval

    // Check if any point is too far outside the oval
    let pointsWithinBounds = 0;
    const threshold = 1.2; // Allow slight deviation from perfect oval

    for (const point of faceOvalPoints) {
      const faceX = point.x * canvas.width;
      const faceY = point.y * canvas.height;

      const normalizedX = (faceX - centerX) / radiusX;
      const normalizedY = (faceY - centerY) / radiusY;
      const distance = normalizedX * normalizedX + normalizedY * normalizedY;

      if (distance <= threshold) {
        pointsWithinBounds++;
      }
    }

    // Consider face within bounds if most points are within the oval
    return pointsWithinBounds >= faceOvalPoints.length;
  };

  const enableWebcam = async () => {
    if (!faceLandmarker) {
      setError("Face detection not initialized");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;
      const videoElement = videoRef.current;
      videoElement.srcObject = stream;
      videoElement.playsInline = true;

      await new Promise<void>((resolve) => {
        videoElement.addEventListener("loadeddata", () => resolve(), { once: true });
      });

      await videoElement.play();
      setIsWebcamEnabled(true);
    } catch (error) {
      console.error("Error enabling webcam:", error);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setError("Failed to enable webcam. Please ensure camera access is allowed.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;
    let frameId: number | null = null;

    const runPrediction = async () => {
      if (!isActive || !videoRef.current || !faceLandmarker || !canvasRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx || video.readyState !== 4) {
        frameId = requestAnimationFrame(runPrediction);
        return;
      }

      // Update canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const startTimeMs = performance.now();

      if (runningMode !== "VIDEO") {
        await faceLandmarker.setOptions({ runningMode: "VIDEO" });
        setRunningMode("VIDEO");
      }

      try {
        const results = await faceLandmarker.detectForVideo(video, startTimeMs);
        const faceCount = results.faceLandmarks?.length || 0;

        // Check for multiple faces
        // Update state for UI feedback
        setMultipleFacesDetected(faceCount > 1);

        if (faceCount > 1) {
          // Reset progress and show red oval when multiple faces are detected
          progressStartTimeRef.current = null;
          setProgress(0);
          setIsFaceInBounds(false);
          drawProgressOval(ctx, 0, true, faceCount);  // Pass actual face count
        } else if (faceCount === 1) {
          // Process single face normally
          const currentIsInBounds = isFaceWithinOval(results.faceLandmarks[0], canvas);
          setIsFaceInBounds(currentIsInBounds);

          if (currentIsInBounds) {
            if (!progressStartTimeRef.current) {
              progressStartTimeRef.current = performance.now();
            }
            const elapsed = performance.now() - progressStartTimeRef.current;
            const newProgress = Math.min(elapsed / 3000, 1);
            setProgress(newProgress);
          } else {
            progressStartTimeRef.current = null;
            setProgress(0);
          }

          // Draw the oval with current progress
          drawProgressOval(ctx, progress, !currentIsInBounds);
        } else {
          // No faces detected
          progressStartTimeRef.current = null;
          setProgress(0);
          setIsFaceInBounds(false);
          drawProgressOval(ctx, 0, false);
        }
      } catch (error) {
        console.error("Error in face detection:", error);
      }

      // Continue the loop
      frameId = requestAnimationFrame(runPrediction);
    };

    if (isWebcamEnabled) {
      runPrediction();
    }

    return () => {
      isActive = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isWebcamEnabled, faceLandmarker, progress, isFaceInBounds, runningMode]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Face Position Detection</CardTitle>
      </CardHeader>
      <CardContent className="w-full">
        <div className="w-full space-y-4">
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-2">
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
              {!isWebcamEnabled && (
                <p className="text-muted-foreground">Webcam not enabled</p>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={enableWebcam}
              disabled={isWebcamEnabled || isLoading}
            >
              <Camera className="mr-2 h-4 w-4" />
              {isLoading ? "Initializing..." : "Enable Webcam"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FaceLandmarkDetector;