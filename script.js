// Continue from previous CSS - here's the COMPLETE JS file:

class ClipMaster {
  constructor() {
    this.videoDuration = 0;
    this.startTime = 0;
    this.endTime = 0;
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    const fetchBtn = document.getElementById('fetchBtn');
    const videoUrl = document.getElementById('videoUrl');
    const downloadBtn = document.getElementById('downloadBtn');

    fetchBtn.addEventListener('click', () => this.fetchVideo());
    videoUrl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.fetchVideo();
    });

    // Trim controls
    document.getElementById('startSlider').addEventListener('input', (e) => this.updateStartTime(e.target.value));
    document.getElementById('endSlider').addEventListener('input', (e) => this.updateEndTime(e.target.value));
    document.getElementById('startTime').addEventListener('input', (e) => this.setStartTime(e.target.value));
    document.getElementById('endTime').addEventListener('input', (e) => this.setEndTime(e.target.value));

    downloadBtn.addEventListener('click', () => this.downloadClip());
  }

  async fetchVideo() {
    const url = document.getElementById('videoUrl').value.trim();
    if (!url) return this.showError('Please enter a YouTube URL');

    const fetchBtn = document.getElementById('fetchBtn');
    this.setLoading(fetchBtn, true);

    try {
      const videoId = this.extractVideoId(url);
      if (!videoId) throw new Error('Invalid YouTube URL');

      const response = await fetch('/api/get-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (!data.success) throw new Error(data.error);

      this.videoDuration = data.duration;
      this.updateSlidersMax(this.videoDuration);

      // Show video section
      this.showSection('videoSection');
      document.getElementById('videoPlayer').src = `https://www.youtube.com/embed/${data.videoId}?controls=1`;
      document.getElementById('thumbnail').src = data.thumbnail;
      document.getElementById('videoTitle').textContent = data.title;
      document.getElementById('videoDuration').textContent = this.formatTime(data.duration);

      // Show trim section
      this.showSection('trimSection');
      this.showSection('downloadSection');

      this.setLoading(fetchBtn, false);
      this.showSuccess('Video loaded successfully!');

    } catch (error) {
      this.setLoading(fetchBtn, false);
      this.showError(error.message);
    }
  }

  updateSlidersMax(duration) {
    const startSlider = document.getElementById('startSlider');
    const endSlider = document.getElementById('endSlider');
    startSlider.max = duration;
    endSlider.max = duration;
  }

  updateStartTime(value) {
    const startTime = parseFloat(value);
    this.startTime = Math.min(startTime, this.endTime - 1);
    
    document.getElementById('startSlider').value = this.startTime;
    document.getElementById('startTime').value = Math.floor(this.startTime);
    document.getElementById('startTimeDisplay').textContent = this.formatTime(this.startTime);
    
    this.updateSliderFill();
    this.updateClipDuration();
    
    // Update video time
    this.seekVideo(this.startTime);
  }

  updateEndTime(value) {
    this.endTime = Math.max(parseFloat(value), this.startTime + 1);
    
    document.getElementById('endSlider').value = this.endTime;
    document.getElementById('endTime').value = Math.floor(this.endTime);
    document.getElementById('endTimeDisplay').textContent = this.formatTime(this.endTime);
    
    this.updateSliderFill();
    this.updateClipDuration();
  }

  setStartTime(value) {
    const time = Math.max(0, Math.min(parseFloat(value), this.videoDuration));
    this.startTime = Math.min(time, this.endTime - 1);
    document.getElementById('startSlider').value = this.startTime;
    document.getElementById('startTimeDisplay').textContent = this.formatTime(this.startTime);
    this.updateSliderFill();
    this.updateClipDuration();
    this.seekVideo(this.startTime);
  }

  setEndTime(value) {
    const time = Math.max(0, Math.min(parseFloat(value), this.videoDuration));
    this.endTime = Math.max(time, this.startTime + 1);
    document.getElementById('endSlider').value = this.endTime;
    document.getElementById('endTimeDisplay').textContent = this.formatTime(this.endTime);
    this.updateSliderFill();
    this.updateClipDuration();
  }

  updateSliderFill() {
    const slider = document.querySelector('.dual-range-slider');
    const fill = document.querySelector('.slider-fill');
    const percentStart = (this.startTime / this.videoDuration) * 100;
    const percentEnd = (this.endTime / this.videoDuration) * 100;
    
    fill.style.left = `${percentStart}%`;
    fill.style.width = `${percentEnd - percentStart}%`;
  }

  updateClipDuration() {
    const duration = this.endTime - this.startTime;
    document.getElementById('clipDuration').textContent = 
      `${this.formatTime(this.startTime)} - ${this.formatTime(this.endTime)} (${this.formatTime(duration)})`;
  }

  seekVideo(time) {
    const player = document.getElementById('videoPlayer');
    player.src = player.src.split('?')[0] + `?t=${Math.floor(time)}`;
  }

  async downloadClip() {
    const downloadBtn = document.getElementById('downloadBtn');
    const progressContainer = document.querySelector('.progress-container');
    
    this.setLoading(downloadBtn, true);
    progressContainer.classList.remove('hidden');

    try {
      const url = document.getElementById('videoUrl').value;
      const quality = document.getElementById('qualitySelect').value;
      const format = document.getElementById('formatSelect').value;

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          startTime: this.startTime,
          endTime: this.endTime,
          quality,
          format
        })
      });

      const data = await response.json();

      if (data.success) {
        this.showDownloadResult(data.downloadUrl, data.filename);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.setLoading(downloadBtn, false);
      progressContainer.classList.add('hidden');
    }
  }

  showSection(sectionId) {
    document.getElementById(sectionId).classList.remove('hidden');
  }

  setLoading(button, loading) {
    const spinner = button.querySelector('.spinner');
    const text = button.querySelector('.btn-text');
    
    if (loading) {
      spinner.classList.remove('hidden');
      text.textContent = 'Loading...';
      button.disabled = true;
    } else {
      spinner.classList.add('hidden');
      text.textContent = button.id === 'fetchBtn' ? 'Fetch Video' : 'Download Clip';
      button.disabled = false;
    }
  }

  showError(message) {
    console.error(message);
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  showDownloadResult(downloadUrl, filename) {
    const result = document.getElementById('downloadResult');
    result.innerHTML = `
      <div class="download-success">
        ✅ Clip ready! 
        <a href="${downloadUrl}" download="${filename}" class="download-link">
          📥 Download ${filename}
        </a>
        <button onclick="navigator.clipboard.writeText('${window.location.origin}${downloadUrl}')" 
                class="copy-btn">
          📋 Copy Link
        </button>
      </div>
    `;
    result.classList.remove('hidden');
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  extractVideoId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  new ClipMaster();
});