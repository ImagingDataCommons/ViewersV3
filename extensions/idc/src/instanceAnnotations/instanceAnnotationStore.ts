import type { InstanceAnnotation } from './extractInstanceAnnotations';

type Listener = () => void;

/**
 * In-memory store mapping a referenced image SOP Instance UID to the list of
 * instance level qualitative annotations that should be rendered over it.
 *
 * The store is intentionally framework agnostic: the viewport overlay component
 * subscribes to change notifications so it can re-render once SR display sets
 * finish loading (which can happen after the overlay has mounted).
 */
class InstanceAnnotationStore {
  private annotationsBySOPInstanceUID = new Map<string, InstanceAnnotation[]>();
  /** Tracks which SR display sets have already been parsed to avoid duplicates. */
  private processedDisplaySetUIDs = new Set<string>();
  private listeners = new Set<Listener>();

  public addAnnotations(displaySetInstanceUID: string, annotations: InstanceAnnotation[]): void {
    if (this.processedDisplaySetUIDs.has(displaySetInstanceUID)) {
      return;
    }
    this.processedDisplaySetUIDs.add(displaySetInstanceUID);

    if (!annotations.length) {
      return;
    }

    annotations.forEach(annotation => {
      const key = annotation.referencedSOPInstanceUID;
      const existing = this.annotationsBySOPInstanceUID.get(key) ?? [];
      existing.push(annotation);
      this.annotationsBySOPInstanceUID.set(key, existing);
    });

    this.notify();
  }

  public getAnnotations(
    sopInstanceUID: string,
    frameNumber?: number
  ): InstanceAnnotation[] {
    if (!sopInstanceUID) {
      return [];
    }

    const annotations = this.annotationsBySOPInstanceUID.get(sopInstanceUID) ?? [];

    if (frameNumber === undefined) {
      return annotations;
    }

    // Keep annotations that either target this specific frame or are frame agnostic.
    return annotations.filter(
      annotation =>
        annotation.referencedFrameNumber === undefined ||
        annotation.referencedFrameNumber === frameNumber
    );
  }

  public hasAnnotations(sopInstanceUID: string): boolean {
    return this.annotationsBySOPInstanceUID.has(sopInstanceUID);
  }

  public clear(): void {
    this.annotationsBySOPInstanceUID.clear();
    this.processedDisplaySetUIDs.clear();
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }
}

/** Shared singleton used by both the registration logic and the overlay UI. */
export const instanceAnnotationStore = new InstanceAnnotationStore();

export default instanceAnnotationStore;
