import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import FaceRecognizer from "./face-recognizer";
import FaceChallenger from "./live-face-detector";
import Stepper from "./stepper";

const steps = [
  {
    title: "Face Recognition",
    description: "Upload your photo ID"
  },
  {
    title: "Liveness Check",
    description: "Complete face verification challenges"
  },
  {
    title: "Complete",
    description: "Verification finished"
  }
];

const EKycFlow = () => {
  const [currentStep, setCurrentStep] = useState<"recognition" | "challenge" | "complete">("recognition");
  const [recognitionVerified, setRecognitionVerified] = useState(false);
  const [livenessVerified, setLivenessVerified] = useState(false);

  // Get numeric step for stepper
  const getStepNumber = () => {
    switch (currentStep) {
      case "recognition":
        return 0;
      case "challenge":
        return 1;
      case "complete":
        return 2;
      default:
        return 0;
    }
  };

  // Handler for when face recognition similarity threshold is met
  const handleRecognitionComplete = () => {
    setRecognitionVerified(true);
  };

  // Handler for when all liveness challenges are completed
  const handleLivenessComplete = () => {
    setLivenessVerified(true);
  };

  // Handler for moving to next step
  const handleNextStep = () => {
    switch (currentStep) {
      case "recognition":
        setCurrentStep("challenge");
        break;
      case "challenge":
        setCurrentStep("complete");
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-8 w-full p-7">
      {/* Stepper */}
      <div className="px-4 p-1">
        <Stepper
          steps={steps}
          currentStep={getStepNumber()}
          className="mb-10 pt-4"
        />
      </div>

      {/* Current step content */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            {steps[getStepNumber()].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === "recognition" && (
            <div className="space-y-4">
              <FaceRecognizer
                onRecognitionComplete={handleRecognitionComplete}
                similarityThreshold={0.75}
              />
              {recognitionVerified && (
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={handleNextStep}
                    className="ml-auto"
                  >
                    Continue to Liveness Check
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {currentStep === "challenge" && (
            <div className="space-y-4">
              <FaceChallenger
                onVerificationComplete={handleLivenessComplete}
              />
              {livenessVerified && (
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={handleNextStep}
                    className="ml-auto"
                  >
                    Complete Verification
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {currentStep === "complete" && (
            <div className="text-center">
              <div className="p-8 bg-primary/10 rounded-lg">
                <h3 className="text-2xl font-bold text-primary mb-2">
                  eKYC Verification Complete!
                </h3>
                <p className="text-muted-foreground">
                  You have successfully completed the identity verification process.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EKycFlow;