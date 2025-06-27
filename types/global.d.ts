declare global {
  interface Window {
    p5: any
    Tone: any
    CCapture: any
    playAudio?: () => void
    pauseAudio?: () => void
  }
}

export {} 