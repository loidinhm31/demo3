declare module "@techstark/opencv-js" {
  export class Mat {
    delete(): void;
    clone(): Mat;
  }

  export class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  export class Size {
    constructor(width: number, height: number);
    width: number;
    height: number;
  }

  export class RectVector {
    constructor();
    size(): number;
    get(index: number): { x: number; y: number; width: number; height: number };
    delete(): void;
  }

  export class CascadeClassifier {
    constructor();
    load(path: string): void;
    detectMultiScale(
      img: Mat,
      objects: RectVector,
      scaleFactor: number,
      minNeighbors: number,
      flags: number,
      minSize: Size,
      maxSize: Size
    ): void;
  }

  export function imread(img: HTMLImageElement): Mat;
  export function imshow(canvas: HTMLCanvasElement, img: Mat): void;
  export function cvtColor(src: Mat, dst: Mat, code: number, dstCn?: number): void;
  export function rectangle(
    img: Mat,
    pt1: Point,
    pt2: Point,
    color: [number, number, number, number],
    thickness?: number
  ): void;

  export const COLOR_RGBA2GRAY: number;
  export const COLOR_BGR2GRAY: number;

  export function FS_createDataFile(
    parent: string,
    name: string,
    data: Uint8Array,
    canRead: boolean,
    canWrite: boolean,
    canOwn: boolean
  ): void;
}