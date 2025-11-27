# TuiliRec - Professional Screen Recording Tool

TuiliRec is a modern, browser-based screen recording tool with AI-powered features including teleprompter and AI interviewer modes.

## ✨ Features

- 🎥 **High-Quality Recording**: Record your screen with camera overlay at 30fps with 8Mbps video quality
- 📝 **AI Teleprompter**: Real-time speech recognition with word highlighting using Aliyun ASR
- 🤖 **AI Interviewer**: Interactive AI conversation mode powered by Gemini Live API
- 🎨 **Customizable Canvas**: Multiple aspect ratios (16:9, 4:3, 9:16, 3:4) with background options
- 📹 **Flexible Camera**: Draggable PIP camera with full-camera mode
- 🎚️ **Audio Mixing**: Seamless mixing of system audio and microphone input
- 🔍 **Zoom & Pan**: Double-click to zoom, drag to pan the canvas

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- A Gemini API key (for AI Interviewer)
- Aliyun ASR credentials (for Teleprompter)

### Installation

1. Clone the repository:
   ```bash
   git clone git@github.com:tuili-ai/rec.tuili.ai.git
   cd rec.tuili.ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and fill in your API credentials:
   - `GEMINI_API_KEY`: Your Gemini API key from https://ai.google.dev/
   - `OPENROUTER_API_KEY`: Your OpenRouter API key from https://openrouter.ai/keys
   - `ALIYUN_ACCESS_KEY_ID`: Aliyun Access Key ID
   - `ALIYUN_ACCESS_KEY_SECRET`: Aliyun Access Key Secret
   - `ALIYUN_TOKEN`: Aliyun ASR token (24-hour validity)
   - `ALIYUN_APP_KEY`: Your Aliyun App Key

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3003 in your browser

## 📖 Usage

### Basic Recording

1. Click "Start Recording" to initialize screen capture and camera
2. Select your screen/window when prompted
3. Adjust aspect ratio and camera position as needed
4. Click the red "Record" button to start recording
5. Click "Stop" when finished - video will download automatically

### AI Teleprompter

1. Click the settings icon to configure your teleprompter script
2. Enable "Teleprompter" mode
3. Start speaking - words will highlight in real-time as you speak
4. Use scroll wheel or click arrows to manually navigate

### AI Interviewer

1. Enable "AI Interviewer" mode
2. Start speaking - AI will generate follow-up questions when you pause
3. Questions appear at the top of the screen to guide your recording

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: TailwindCSS
- **AI Services**:
  - Gemini Live API (AI Interviewer)
  - Aliyun Real-time ASR (Teleprompter)
  - OpenRouter API (Alternative AI models)
- **Recording**: MediaRecorder API, Canvas API, Web Audio API

## 📝 Configuration

See [.env.example](.env.example) for all available environment variables.

For detailed Aliyun ASR setup instructions, see [ALIYUN_ASR_SETUP.md](ALIYUN_ASR_SETUP.md).

## 🔧 Build

To build for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

## 📄 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ by Tuili AI
