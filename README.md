# Music Visualizer

A real-time music visualization app built with Next.js, p5.js, and Tone.js that creates stunning animated visualizations based on uploaded MP3 files.

## Features

- 🎵 **Drag & Drop Audio Upload** - Simply drag and drop your MP3 files onto the interface
- 🎨 **Real-time Visualizations** - Dynamic particles, waves, and frequency spectrums that react to music
- 🎛️ **Audio Analysis** - Real-time analysis of bass, mid, and treble frequencies
- 🎥 **Video Recording** - Export 30-second video recordings of your visualizations
- 📱 **Mobile Responsive** - Touch-friendly interface that works on all devices
- 🖥️ **Fullscreen Mode** - Immersive fullscreen experience
- 🎨 **Color Cycling** - Beautiful HSB color transitions that pulse with the music

## Visual Effects

- **Glowing Particles** - Particles that spawn from the bottom and float upward based on bass frequencies
- **Animated Waves** - Smooth sine waves that respond to mid-range frequencies
- **Frequency Spectrum** - Real-time frequency bars at the bottom of the screen
- **Dynamic Colors** - Colors that cycle and change based on the music's energy

## Tech Stack

- **Next.js 14** - React framework with App Router
- **p5.js** - Creative coding library for 2D graphics
- **Tone.js** - Web Audio framework for audio processing
- **CCapture.js** - Canvas recording library for video export
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd music-visualizer
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Upload Audio**: Drag and drop an MP3 file onto the upload area or click to browse
2. **Play Music**: Click the play button to start the visualization
3. **Control Visuals**: Use the control panel to pause, toggle fullscreen, or record
4. **Record Video**: Click "Record 30s" to capture a 30-second video of your visualization
5. **Reset**: Click reset to upload a new file

## Audio Analysis

The app analyzes three frequency bands:
- **Bass** (0-200Hz): Controls particle generation and size
- **Mid** (200-2000Hz): Controls wave amplitude and movement
- **Treble** (2000Hz+): Controls color cycling and wave frequency

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

**Note**: Audio recording features require HTTPS in production due to browser security policies.

## Development

### Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout with external scripts
│   ├── page.tsx            # Main page component
│   └── globals.css         # Global styles
├── components/
│   └── MusicVisualizer.tsx # p5.js visualization component
├── types/
│   └── global.d.ts         # TypeScript declarations
└── public/                 # Static assets
```

### Key Components

- **MusicVisualizer**: Handles p5.js canvas, audio analysis, and visual effects
- **Audio Analysis**: Real-time frequency analysis using Web Audio API
- **Particle System**: Dynamic particle generation based on bass frequencies
- **Wave System**: Animated waves responding to mid-range frequencies
- **Recording System**: Video capture using CCapture.js

## Customization

### Adding New Visual Effects

1. Create new functions in the p5.js sketch
2. Add them to the `draw()` function
3. Connect them to audio data for reactivity

### Modifying Colors

The app uses HSB color mode. Modify the `hue` variable and color creation functions to change the color scheme.

### Adjusting Sensitivity

Modify the frequency analysis thresholds in the `createParticle()` and `createWave()` functions to adjust how the visuals respond to different frequency ranges.

## Troubleshooting

### Audio Not Playing
- Ensure your browser supports Web Audio API
- Check that the audio file is valid and not corrupted
- Try refreshing the page and uploading again

### Recording Not Working
- Ensure you're using HTTPS in production
- Check browser console for errors
- Verify CCapture.js is loaded properly

### Performance Issues
- Reduce the number of particles by modifying the particle generation logic
- Lower the canvas resolution for better performance on mobile devices
- Close other tabs to free up system resources

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Acknowledgments

- p5.js community for the amazing creative coding library
- Tone.js team for the excellent Web Audio framework
- CCapture.js for the canvas recording functionality 