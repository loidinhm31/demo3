export const ImageProcessor = {
  // Basic grayscale conversion with optimal weights for face recognition
  convertToGrayscale: (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Using BT.601 standard weights for more accurate face features
      const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      data[i] = gray;     // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  },

  // Enhanced face cropping with balanced padding
  cropToFaceRegion: (image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement, detection: any) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const box = detection.boundingBox;

    // Use fixed padding that worked well in the original version
    const padding = 20; // Return to fixed padding as it was more reliable

    canvas.width = box.width + (padding * 2);
    canvas.height = box.height + (padding * 2);

    ctx.drawImage(
      image,
      box.originX - padding,
      box.originY - padding,
      box.width + (padding * 2),
      box.height + (padding * 2),
      0,
      0,
      canvas.width,
      canvas.height
    );

    return canvas;
  },

  // Process image with minimal preprocessing to maintain important features
  processForEmbedding: async (image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement, detection: any) => {
    // First crop the face region
    const faceCanvas = ImageProcessor.cropToFaceRegion(image, detection);

    // Convert to grayscale
    const grayscaleCanvas = document.createElement("canvas");
    grayscaleCanvas.width = faceCanvas.width;
    grayscaleCanvas.height = faceCanvas.height;
    grayscaleCanvas.getContext("2d").drawImage(faceCanvas, 0, 0);

    return ImageProcessor.convertToGrayscale(grayscaleCanvas);
  }
};