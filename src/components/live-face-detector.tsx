import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Constants for challenge types and blendshapes moved to separate objects
const ChallengeType = {
  FACE_LEFT: "FACE_LEFT",
  FACE_RIGHT: "FACE_RIGHT",
  FACE_UP: "FACE_UP",
  FACE_DOWN: "FACE_DOWN",
  BLINK: "BLINK"
} as const;

const BlendshapeNames = {
  LEFT_EYE_BLINK: "eyeBlinkLeft",
  RIGHT_EYE_BLINK: "eyeBlinkRight"
} as const;

type ChallengeType = typeof ChallengeType[keyof typeof ChallengeType];
type DetectionResults = {
  faceBlendshapes?: Array<{ categories: Array<{ categoryName: string; score: number }> }>;
  faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
};

interface DrawOvalOptions {
  ctx: CanvasRenderingContext2D;
  progress: number;
  isFaceOutbound: boolean;
  currentChallenge?: ChallengeType;
  isFaceInBounds: boolean;
}

const LiveFaceDetector: React.FC = () => {
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
  const [runningMode, setRunningMode] = useState("IMAGE");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [isFaceInBounds, setIsFaceInBounds] = useState(false);
  const [challenges, setChallenges] = useState<ChallengeType[]>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(-1);
  const [verificationComplete, setVerificationComplete] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const progressStartTimeRef = useRef<number | null>(null);
  const lastVerificationTimeRef = useRef(0);
  const challengeStartTimeRef = useRef<number | null>(null);

  const getBaseUrl = (): string => {
    const isDev = import.meta.env.DEV;
    return isDev ? window.location.origin :
      import.meta.env.BASE_URL ?
        new URL(import.meta.env.BASE_URL, window.location.origin).toString() :
        window.location.origin;
  };

  // Helper function to draw progress oval with challenge text
  const drawProgressOval = ({
                              ctx,
                              progress,
                              isFaceOutbound,
                              currentChallenge,
                              isFaceInBounds
                            }: DrawOvalOptions): void => {
    const canvas = ctx.canvas;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radiusX = canvas.width * 0.12;
    const radiusY = canvas.height * 0.42;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background oval with shadow
    ctx.save();
    ctx.shadowColor = "#C0C0C0";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = isFaceOutbound ? "#FFC000" : "#D3D3D3";
    ctx.lineWidth = 10;
    ctx.setLineDash([10, 5]);
    ctx.stroke();

    if (progress > 0) {
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
      ctx.strokeStyle = "#32CD32";
      ctx.lineWidth = 10;
      ctx.setLineDash([]);
      ctx.stroke();
    }

    // Draw challenge text
    if (currentChallenge) {
      ctx.font = "24px Arial";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const text = !isFaceInBounds ? "Move face into frame" :
        getChallengeText(currentChallenge);
      ctx.fillText(text, centerX, centerY - radiusY - 20);
    }

    ctx.restore();
  };

  // Function to get challenge instruction text
  const getChallengeText = (challenge: ChallengeType): string => {
    switch (challenge) {
      case ChallengeType.FACE_LEFT:
        return "Turn Left";
      case ChallengeType.FACE_RIGHT:
        return "Turn Right";
      case ChallengeType.FACE_UP:
        return "Look Up";
      case ChallengeType.FACE_DOWN:
        return "Look Down";
      case ChallengeType.BLINK:
        return "Blink";
      default:
        return "";
    }
  };

  // Function to check if face is within oval bounds
  const isFaceWithinOval = (landmarks: Array<{ x: number; y: number; z: number }>): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radiusX = canvas.width * 0.15;
    const radiusY = canvas.height * 0.4;

    const faceOvalPoints = landmarks.slice(0, 36);
    let pointsWithinBounds = 0;
    const threshold = 1.2;

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

    return pointsWithinBounds >= faceOvalPoints.length * 0.8;
  };

  // Helper function to get blendshape value
  const getBlendshapeValue = (blendshapes: Array<{
    categoryName: string;
    score: number
  }>, categoryName: string): number => {
    const category = blendshapes.find(b => b.categoryName === categoryName);
    return category ? category.score : 0;
  };

  // Function to verify challenge completion
  const verifyChallenge = (results: DetectionResults, checkPositionOnly = false): boolean => {
    if (!results.faceBlendshapes?.length || !results.faceLandmarks?.length) return false;

    const blendshapes = results.faceBlendshapes[0].categories;
    const currentChallenge = challenges[currentChallengeIndex];
    const landmarks = results.faceLandmarks[0];

    // Get the current time for verification timing
    const now = performance.now();
    if (currentChallenge === ChallengeType.BLINK && now - lastVerificationTimeRef.current < 1000) {
      return false;
    }

    // Calculate face dimensions and position
    const faceWidth = Math.abs(landmarks[234].x - landmarks[454].x);
    const faceCenterX = (landmarks[234].x + landmarks[454].x) / 2;

    // Helper function to calculate vertical angle using nose and forehead landmarks
    const calculateVerticalAngle = (): number => {
      const noseTip = landmarks[4]; // Nose tip
      const foreheadCenter = landmarks[10]; // Forehead center
      const verticalDiff = noseTip.z - foreheadCenter.z;
      return Math.atan2(verticalDiff, Math.abs(noseTip.y - foreheadCenter.y));
    };

    // Check if face position is correct based on challenge type
    const checkPosition = (): boolean => {
      switch (currentChallenge) {
        case ChallengeType.FACE_LEFT: {
          const noseTip = landmarks[4];
          const noseOffset = (noseTip.x - faceCenterX) / faceWidth;
          return noseOffset > 0.5;
        }
        case ChallengeType.FACE_RIGHT: {
          const noseTip = landmarks[4];
          const noseOffset = (noseTip.x - faceCenterX) / faceWidth;
          return noseOffset < -0.5;
        }
        case ChallengeType.FACE_UP: {
          const angle = calculateVerticalAngle();
          return angle < -0.3; // Threshold for looking up
        }
        case ChallengeType.FACE_DOWN: {
          const angle = calculateVerticalAngle();
          return angle > 0.06; // Threshold for looking down
        }
        case ChallengeType.BLINK: {
          const leftBlink = getBlendshapeValue(blendshapes, BlendshapeNames.LEFT_EYE_BLINK);
          const rightBlink = getBlendshapeValue(blendshapes, BlendshapeNames.RIGHT_EYE_BLINK);
          return leftBlink > 0.5 && rightBlink > 0.5;
        }
        default:
          return false;
      }
    };

    const isInCorrectPosition = checkPosition();

    // For all face movement challenges except blink
    if (currentChallenge !== ChallengeType.BLINK) {
      if (checkPositionOnly) {
        return isInCorrectPosition;
      }

      if (isInCorrectPosition) {
        const timeInPosition = challengeStartTimeRef.current ? (now - challengeStartTimeRef.current) : 0;
        return timeInPosition >= 3000;
      }
      return false;
    }

    // For blink challenge
    return currentChallenge === ChallengeType.BLINK && isInCorrectPosition;
  };

  // Function to generate random challenges
  const generateRandomChallenges = (): void => {
    const allChallengeTypes = [
      ChallengeType.FACE_LEFT,
      ChallengeType.FACE_RIGHT,
      ChallengeType.FACE_UP,
      ChallengeType.FACE_DOWN,
      ChallengeType.BLINK
    ];

    // Shuffle all challenges and pick first 3
    const shuffled = [...allChallengeTypes]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    setChallenges(shuffled);
    setCurrentChallengeIndex(-1);
    setVerificationComplete(false);
  };

  // Function to enable webcam
  const enableWebcam = async (): Promise<void> => {
    if (!faceLandmarker) {
      setError("Face detection not initialized");
      return;
    }

    if (verificationComplete) {
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;
      if (!videoRef.current) return;

      const videoElement = videoRef.current;
      videoElement.srcObject = stream;
      videoElement.playsInline = true;

      await new Promise<void>((resolve) => {
        videoElement.addEventListener("loadeddata", () => resolve(), { once: true });
      });

      await videoElement.play();
      generateRandomChallenges();
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
          numFaces: 1
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

  // Main prediction loop
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

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const startTimeMs = performance.now();

      if (runningMode !== "VIDEO") {
        await faceLandmarker.setOptions({ runningMode: "VIDEO" });
        setRunningMode("VIDEO");
      }

      try {
        const results = await faceLandmarker.detectForVideo(video, startTimeMs);

        if (results.faceLandmarks?.length === 1) {
          const currentIsInBounds = isFaceWithinOval(results.faceLandmarks[0]);
          setIsFaceInBounds(currentIsInBounds);

          if (currentIsInBounds) {
            if (currentChallengeIndex === -1) {
              if (!progressStartTimeRef.current) {
                progressStartTimeRef.current = performance.now();
              }
              const timeInBounds = performance.now() - progressStartTimeRef.current;
              if (timeInBounds > 1000) {
                setCurrentChallengeIndex(0);
              }
            } else if (currentChallengeIndex < challenges.length) {
              const currentChallenge = challenges[currentChallengeIndex];
              const now = performance.now();

              // Calculate current progress for face movement challenges
              let currentProgress = 0;
              if (currentChallenge !== ChallengeType.BLINK) {
                // Check if face is in correct position without completing the challenge
                const isCorrectPos = verifyChallenge(results, true);
                if (isCorrectPos) {
                  if (!challengeStartTimeRef.current) {
                    challengeStartTimeRef.current = now;
                  }
                  const timeInPosition = now - challengeStartTimeRef.current;
                  currentProgress = Math.min(timeInPosition / 3000, 1); // 3 seconds for full progress
                } else {
                  challengeStartTimeRef.current = null;
                }
              }

              // Draw progress oval with current progress
              drawProgressOval({
                ctx,
                progress: currentProgress,
                isFaceOutbound: !currentIsInBounds,
                currentChallenge,
                isFaceInBounds: currentIsInBounds
              });

              // Check for challenge completion
              if (verifyChallenge(results)) {
                lastVerificationTimeRef.current = now;
                challengeStartTimeRef.current = null;
                setProgress(0);

                if (currentChallengeIndex === challenges.length - 1) {
                  setVerificationComplete(true);
                  setCurrentChallengeIndex(-1);
                  // Clean up webcam and stream when verification is complete
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                  }
                  setIsWebcamEnabled(false);
                } else {
                  setCurrentChallengeIndex(prev => prev + 1);
                }
              }
            }
          } else {
            progressStartTimeRef.current = null;
            challengeStartTimeRef.current = null;
            setProgress(0);
            drawProgressOval({
              ctx,
              progress: 0,
              isFaceOutbound: !currentIsInBounds,
              currentChallenge: challenges[currentChallengeIndex],
              isFaceInBounds: currentIsInBounds
            });
          }
        } else {
          progressStartTimeRef.current = null;
          challengeStartTimeRef.current = null;
          setProgress(0);
          setIsFaceInBounds(false);
          drawProgressOval({
            ctx,
            progress: 0,
            isFaceOutbound: true,
            currentChallenge: challenges[currentChallengeIndex],
            isFaceInBounds: false
          });
        }
      } catch (error) {
        console.error("Error in face detection:", error);
      }

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
  }, [isWebcamEnabled, faceLandmarker, progress, isFaceInBounds, runningMode, challenges, currentChallengeIndex]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Face Challenge Verification</CardTitle>
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
              {!isWebcamEnabled && !verificationComplete && (
                <p className="text-muted-foreground">Webcam not enabled</p>
              )}
              {verificationComplete && (
                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                  <p className="text-3xl font-bold text-green-500">Verification Complete!</p>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (verificationComplete) {
                  setVerificationComplete(false);
                  generateRandomChallenges();
                }
                enableWebcam();
              }}
              disabled={isWebcamEnabled || isLoading}
            >
              <Camera className="mr-2 h-4 w-4" />
              {isLoading ? "Initializing..." :
                verificationComplete ? "Start New Verification" : "Start Verification"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveFaceDetector;