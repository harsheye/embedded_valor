export class Timeline {
  constructor(public seekMap?: any[]) {}

  /**
   * Check if there is significant drift between video currentTime and AudioContext playhead
   * Returns true if drift is > 350ms (significant)
   */
  public checkDrift(currentTime: number, audioPlayhead: number | null): boolean {
    if (audioPlayhead !== null) {
      const drift = Math.abs(currentTime - audioPlayhead);
      if (drift > 0.35) {
        return true;
      }
    }
    return false;
  }
}
