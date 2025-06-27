'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the MusicVisualizer component to avoid SSR issues with p5.js
const MusicVisualizer = dynamic(() => import('../components/MusicVisualizer'), {
  ssr: false,
  loading: () => <div>Loading visualizer...</div>
})

const visualStyles = [
  { label: 'Sphere', value: 'sphere' },
  { label: 'Nebula', value: 'nebula' },
  { label: 'Matrix', value: 'matrix' },
  { label: 'Vortex', value: 'vortex' },
  { label: 'Crystal', value: 'crystal' },
  { label: 'Spiral', value: 'spiral' },
  { label: 'Forest', value: 'forest' },
]

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Home() {
  const [audioSource, setAudioSource] = useState<File | string | null>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'youtube'>('file')
  const [isDragging, setIsDragging] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [audioData, setAudioData] = useState({
    bass: 0,
    mid: 0,
    treble: 0,
    overall: 0
  })
  const [visualStyle, setVisualStyle] = useState('sphere')
  const [audioTime, setAudioTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [seekValue, setSeekValue] = useState(0)
  const seekRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (file: File) => {
    if (file.type.startsWith('audio/')) {
      setAudioSource(file)
    }
  }

  const handleUrlSubmit = () => {
    if (audioUrl.trim()) {
      try {
        new URL(audioUrl.trim());
        setAudioSource(audioUrl.trim());
      } catch (error) {
        alert('Please enter a valid URL');
      }
    }
  }

  const handleYoutubeUrlSubmit = () => {
    if (youtubeUrl.trim()) {
      try {
        const url = new URL(youtubeUrl.trim());
        if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
          // Show instructions for extracting audio URL
          alert('YouTube video detected! To use this video:\n\n1. Right-click on the video and select "Copy video URL"\n2. Use a YouTube to MP3 converter service\n3. Copy the direct audio URL\n4. Paste it in the "Audio URL" tab\n\nNote: This app cannot directly process YouTube video URLs due to legal restrictions.');
        } else {
          alert('Please enter a valid YouTube URL');
        }
      } catch (error) {
        alert('Please enter a valid URL');
      }
    }
  }

  const handleUrlKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (activeTab === 'url') {
        handleUrlSubmit()
      } else if (activeTab === 'youtube') {
        handleYoutubeUrlSubmit()
      }
    }
  }

  // Mobile-specific touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent default touch behavior that might interfere with the app
    e.preventDefault()
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    // Allow touch move for scrolling but prevent default for certain elements
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
      return // Allow normal touch behavior for form elements
    }
    // Prevent default for other elements to avoid unwanted scrolling
    e.preventDefault()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const toggleRecording = () => {
    if (!isRecording) {
      // Start recording
      setIsRecording(true);
      if (typeof window !== 'undefined' && (window as any).startVisualizerRecording) {
        (window as any).startVisualizerRecording();
      }
    } else {
      // Stop recording
      setIsRecording(false);
      if (typeof window !== 'undefined' && (window as any).stopVisualizerRecording) {
        (window as any).stopVisualizerRecording();
      }
    }
  }

  const resetVisualizer = () => {
    setAudioSource(null)
    setAudioUrl('')
    setYoutubeUrl('')
    setActiveTab('file')
    setIsPlaying(false)
    setIsRecording(false)
  }

  return (
    <main 
      className="h-screen w-screen overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {/* Canvas Container */}
      <div className="canvas-container">
        {audioSource && (
          <MusicVisualizer
            audioSource={audioSource}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            isRecording={isRecording}
            setAudioData={setAudioData}
            visualStyle={visualStyle}
            onTimeUpdate={setAudioTime}
            onDuration={setAudioDuration}
            onSeek={val => setSeekValue(val)}
            seekValue={seekValue}
          />
        )}
      </div>

      {/* Controls Overlay */}
      <div className="controls-overlay">
        {/* Upload Area */}
        {!audioSource && (
          <div className="upload-container">
            <div className="upload-tabs">
              <div 
                className={`upload-tab ${activeTab === 'file' ? 'active' : ''}`}
                onClick={() => setActiveTab('file')}
              >
                Upload File
              </div>
              <div 
                className={`upload-tab ${activeTab === 'url' ? 'active' : ''}`}
                onClick={() => setActiveTab('url')}
              >
                Audio URL
              </div>
              <div 
                className={`upload-tab ${activeTab === 'youtube' ? 'active' : ''}`}
                onClick={() => setActiveTab('youtube')}
              >
                YouTube
              </div>
            </div>
            
            {/* File Upload Tab */}
            <div className={`upload-content ${activeTab === 'file' ? 'active' : ''}`}>
              <div
                className={`upload-area ${isDragging ? 'dragover' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <div className="upload-icon">🎵</div>
                <div className="upload-text">Drop your audio file here</div>
                <div className="upload-subtext">or click to browse</div>
                <input
                  id="file-input"
                  type="file"
                  accept="audio/*"
                  onChange={handleFileInput}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
            
            {/* URL Input Tab */}
            <div className={`url-input-container ${activeTab === 'url' ? 'active' : ''}`}>
              <div className="url-input-wrapper">
                <input
                  type="url"
                  placeholder="Enter audio URL (MP3, WAV, etc.)"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  onKeyPress={handleUrlKeyPress}
                  className="url-input"
                />
                <button 
                  onClick={handleUrlSubmit}
                  className="url-submit-btn"
                  disabled={!audioUrl.trim()}
                >
                  Load Audio
                </button>
              </div>
              <div className="url-examples">
                <div>Examples:</div>
                <div>• https://example.com/song.mp3</div>
                <div>• https://cdn.example.com/audio.wav</div>
              </div>
            </div>

            {/* YouTube Input Tab */}
            <div className={`youtube-input-container ${activeTab === 'youtube' ? 'active' : ''}`}>
              <div className="youtube-disclaimer">
                <div className="disclaimer-icon">⚠️</div>
                <div className="disclaimer-text">
                  <strong>Legal Notice:</strong> This app cannot directly process YouTube video URLs due to copyright restrictions. 
                  You must extract the audio URL yourself using external services.
                </div>
              </div>
              <div className="youtube-input-wrapper">
                <input
                  type="url"
                  placeholder="Enter YouTube video URL"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyPress={handleUrlKeyPress}
                  className="youtube-input"
                />
                <button 
                  onClick={handleYoutubeUrlSubmit}
                  className="youtube-submit-btn"
                  disabled={!youtubeUrl.trim()}
                >
                  Get Instructions
                </button>
              </div>
              <div className="youtube-instructions">
                <div className="instructions-title">How to use YouTube videos:</div>
                <div className="instructions-steps">
                  <div>1. Paste a YouTube URL above and click "Get Instructions"</div>
                  <div>2. Use a YouTube to MP3 converter service</div>
                  <div>3. Copy the direct audio URL from the converter</div>
                  <div>4. Paste the audio URL in the "Audio URL" tab</div>
                </div>
                <div className="youtube-examples">
                  <div>YouTube URL Examples:</div>
                  <div>• https://www.youtube.com/watch?v=dQw4w9WgXcQ</div>
                  <div>• https://youtu.be/dQw4w9WgXcQ</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Control Panel */}
        {audioSource && (
          <div className="control-panel">
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              marginRight: 16,
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              <label htmlFor="visual-style" style={{ 
                color: '#fff', 
                fontSize: window.innerWidth <= 768 ? 12 : 14, 
                marginRight: 6 
              }}>
                Visual:
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  id="visual-style"
                  value={visualStyle}
                  onChange={e => setVisualStyle(e.target.value)}
                  style={{
                    background: 'rgba(30,30,30,0.95)',
                    color: '#fff',
                    border: '1px solid #444',
                    borderRadius: 18,
                    padding: window.innerWidth <= 768 ? '6px 24px 6px 12px' : '8px 32px 8px 16px',
                    fontSize: window.innerWidth <= 768 ? 13 : 15,
                    appearance: 'none',
                    outline: 'none',
                    minWidth: window.innerWidth <= 768 ? 80 : 100,
                    fontWeight: 500,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                >
                  {visualStyles.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <span style={{
                  position: 'absolute',
                  right: window.innerWidth <= 768 ? 8 : 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#aaa',
                  fontSize: window.innerWidth <= 768 ? 14 : 18
                }}>▼</span>
              </div>
            </div>
            <button
              className="control-button"
              onClick={() => setIsPlaying(!isPlaying)}
              style={{ minWidth: window.innerWidth <= 768 ? '60px' : 'auto' }}
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            <button
              className="control-button"
              onClick={toggleFullscreen}
              style={{ minWidth: window.innerWidth <= 768 ? '60px' : 'auto' }}
            >
              {isFullscreen ? '⏹️ Exit' : '⛶ Full'}
            </button>
            <button
              className={`control-button ${isRecording ? 'recording' : ''}`}
              onClick={toggleRecording}
              style={{ minWidth: window.innerWidth <= 768 ? '60px' : 'auto' }}
            >
              {isRecording ? '⏺️ Stop' : '🎥 Record'}
            </button>
            <button
              className="control-button"
              onClick={resetVisualizer}
              style={{ minWidth: window.innerWidth <= 768 ? '60px' : 'auto' }}
            >
              🔄 Reset
            </button>
          </div>
        )}

        {/* Audio Info */}
        {audioSource && (
          <div className="visualization-info">
            <div>Source: {typeof audioSource === 'string' ? 
              (audioSource.includes('/') ? audioSource.split('/').pop()?.split('?')[0] || 'Audio URL' : 'Audio URL') : 
              audioSource.name}</div>
            <div>Status: {isPlaying ? 'Playing' : 'Paused'}</div>
            <div>Bass: {Math.round(Math.max(0, Math.min(1, audioData.bass)) * 100)}%</div>
            <div>Mid: {Math.round(Math.max(0, Math.min(1, audioData.mid)) * 100)}%</div>
            <div>Treble: {Math.round(Math.max(0, Math.min(1, audioData.treble)) * 100)}%</div>
          </div>
        )}

        {/* Audio Seek Bar */}
        {audioSource && audioDuration > 0 && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            marginTop: window.innerWidth <= 768 ? 8 : 12,
            padding: window.innerWidth <= 768 ? '0 10px' : '0'
          }}>
            <span style={{ 
              color: '#aaa', 
              fontSize: window.innerWidth <= 768 ? 11 : 13, 
              minWidth: window.innerWidth <= 768 ? 30 : 40, 
              textAlign: 'right', 
              marginRight: window.innerWidth <= 768 ? 6 : 8 
            }}>
              {formatTime(audioTime)}
            </span>
            <input
              type="range"
              min={0}
              max={audioDuration}
              step={0.01}
              value={seekValue !== 0 ? seekValue : audioTime}
              onChange={e => setSeekValue(Number(e.target.value))}
              onMouseUp={e => setSeekValue(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={e => setSeekValue(Number((e.target as HTMLInputElement).value))}
              style={{ 
                width: window.innerWidth <= 768 ? 250 : 320, 
                accentColor: '#fff', 
                margin: '0 8px',
                height: window.innerWidth <= 768 ? '20px' : 'auto'
              }}
            />
            <span style={{ 
              color: '#aaa', 
              fontSize: window.innerWidth <= 768 ? 11 : 13, 
              minWidth: window.innerWidth <= 768 ? 30 : 40, 
              textAlign: 'left', 
              marginLeft: window.innerWidth <= 768 ? 6 : 8 
            }}>
              {formatTime(audioDuration)}
            </span>
          </div>
        )}
      </div>
    </main>
  )
}