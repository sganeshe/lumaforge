# LUMAFORGE 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

**Professional Web-Based Optics & Color Grading Engine.**

LUMAFORGE is a high-performance, browser-native digital darkroom. It provides professional colorimetry tools, non-linear curve mathematics, and cinematic film emulation without requiring localized software installations. It is designed to give users a seamless, professional-grade photo editing experience directly on the web.

## ✨ Features
* **Mathematical Optics Engine:** Custom GPU-accelerated canvas pipeline utilizing cosine-interpolated RGB curves and 3-way zone grading.
* **LUT Support:** Full parsing and generation of industry-standard Adobe `.CUBE` 3D Look-Up Tables.
* **Steganographic Metadata:** The engine encodes your entire editing workspace invisibly into the exported `.png` headers. 
* **Procedural Film Emulation:** Dynamic luma-masked hash noise and threshold-based halation bloom.
* **Cloud Uplink:** Secure authentication and preset storage powered by Supabase.

## 🚀 Quick Start
Get the development environment set up and running locally.

```bash
# Clone the repository
git clone [https://github.com/sganeshe/lumaforge.git](https://github.com/sganeshe/lumaforge.git)
cd lumaforge

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env

# Run the local development server
npm run dev
```

## 🤝 Contributing
Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/NewOpticFilter`)
3. Commit your Changes (`git commit -m 'Add a new optic filter'`)
4. Push to the Branch (`git push origin feature/NewOpticFilter`)
5. Open a Pull Request

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Created by [Saumya Ganeshe](https://sganeshe.live)*