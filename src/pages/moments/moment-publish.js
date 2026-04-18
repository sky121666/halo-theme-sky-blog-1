const BLOCKED_EXTENSIONS = ['.svg', '.html', '.htm', '.js', '.exe', '.bat', '.sh', '.php'];

const MEDIA_ACCEPTS = {
  image: 'image/jpeg,image/jpg,image/png,image/gif,image/webp',
  video: 'video/mp4,video/webm,video/ogg,video/quicktime',
  audio: 'audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/m4a',
};

function getElement(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function validateUrl(url) {
  if (!url) return false;

  const lower = url.toLowerCase();
  return !lower.startsWith('javascript:') && !lower.startsWith('data:');
}

function sanitizeTag(tag) {
  return tag.replace(/[<>'"&]/g, '').trim();
}

function initMomentPublishModal() {
  const modal = getElement('moment-publish-modal');
  if (!modal || modal.dataset.initialized === 'true') {
    return;
  }

  modal.dataset.initialized = 'true';

  const ownerName = modal.dataset.ownerName || '';
  let selectedTags = [];
  let uploadedMedia = [];

  function isBlockedExtension(fileName) {
    const ext = `.${fileName.split('.').pop()}`.toLowerCase();
    return BLOCKED_EXTENSIONS.includes(ext);
  }

  function updateMediaPreview() {
    const container = getElement('moment-media-preview');
    const list = getElement('moment-media-list');

    if (!container || !list) {
      return;
    }

    if (uploadedMedia.length === 0) {
      container.classList.add('hidden');
      list.className = '';
      list.innerHTML = '';
      return;
    }

    container.classList.remove('hidden');
    list.innerHTML = '';

    const mediaCount = uploadedMedia.length;

    if (mediaCount === 1) {
      list.className = '';
      const media = uploadedMedia[0];
      const wrapper = document.createElement('div');
      wrapper.className = 'relative rounded-xl overflow-hidden bg-base-200 group';

      if (media.type === 'PHOTO') {
        const img = document.createElement('img');
        img.src = media.url;
        img.alt = '预览';
        img.className = 'rounded-xl max-h-72 object-cover w-auto mx-auto';
        img.loading = 'lazy';
        wrapper.appendChild(img);
      } else if (media.type === 'VIDEO') {
        const video = document.createElement('video');
        video.src = media.url;
        video.className = 'rounded-xl max-h-72 w-full';
        video.preload = 'metadata';
        wrapper.appendChild(video);

        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none';
        overlay.innerHTML = '<span class="icon-[heroicons--play-circle] w-16 h-16 text-white"></span>';
        wrapper.appendChild(overlay);
      } else if (media.type === 'AUDIO') {
        wrapper.className = 'bg-base-200 rounded-xl p-3';
        const audio = document.createElement('audio');
        audio.src = media.url;
        audio.controls = true;
        audio.className = 'w-full';
        wrapper.appendChild(audio);
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'absolute top-2 right-2 w-7 h-7 rounded-full bg-error text-error-content flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg';
      deleteBtn.innerHTML = '<span class="icon-[heroicons--x-mark] w-5 h-5"></span>';
      deleteBtn.onclick = () => window.removeMedia(0);
      wrapper.appendChild(deleteBtn);

      list.appendChild(wrapper);
      return;
    }

    let gridClass = 'grid-cols-3';
    if (mediaCount === 2 || mediaCount === 4) gridClass = 'grid-cols-2 w-3/4';
    else if (mediaCount === 5 || mediaCount === 8) gridClass = 'grid-cols-6';
    else if (mediaCount === 7) gridClass = 'grid-cols-12';

    list.className = `grid gap-1 rounded-xl overflow-hidden ${gridClass}`;

    uploadedMedia.forEach((media, index) => {
      const wrapper = document.createElement('div');

      let itemClass = 'aspect-square';
      if (mediaCount === 3 && index === 0) itemClass = 'col-span-2 row-span-2 aspect-square';
      else if (mediaCount === 3 && index > 0) itemClass = 'col-span-1 aspect-square';
      else if (mediaCount === 5 && index < 2) itemClass = 'col-span-3 aspect-[4/3]';
      else if (mediaCount === 5 && index >= 2) itemClass = 'col-span-2 aspect-square';
      else if (mediaCount === 7 && index < 3) itemClass = 'col-span-4 aspect-square';
      else if (mediaCount === 7 && index >= 3) itemClass = 'col-span-3 aspect-square';
      else if (mediaCount === 8 && index < 2) itemClass = 'col-span-3 aspect-[4/3]';
      else if (mediaCount === 8 && index >= 2) itemClass = 'col-span-2 aspect-square';

      wrapper.className = `relative bg-base-200 overflow-hidden group ${itemClass}`;

      if (media.type === 'PHOTO') {
        const img = document.createElement('img');
        img.src = media.url;
        img.alt = '预览';
        img.className = 'w-full h-full object-cover';
        img.loading = 'lazy';
        wrapper.appendChild(img);
      } else if (media.type === 'VIDEO') {
        const video = document.createElement('video');
        video.src = media.url;
        video.className = 'w-full h-full object-cover';
        video.preload = 'metadata';
        wrapper.appendChild(video);

        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none';
        overlay.innerHTML = '<span class="icon-[heroicons--play-circle] w-10 h-10 text-white"></span>';
        wrapper.appendChild(overlay);
      } else if (media.type === 'AUDIO') {
        wrapper.className += ' flex flex-col items-center justify-center p-2';
        const icon = document.createElement('span');
        icon.className = 'icon-[heroicons--musical-note] w-10 h-10 text-base-content/40 mb-1';
        wrapper.appendChild(icon);

        const fileName = document.createElement('div');
        fileName.className = 'text-xs text-base-content/60 truncate w-full text-center px-1';
        fileName.textContent = media.fileName || '音频';
        wrapper.appendChild(fileName);
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'absolute top-1 right-1 w-6 h-6 rounded-full bg-error text-error-content flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg';
      deleteBtn.innerHTML = '<span class="icon-[heroicons--x-mark] w-4 h-4"></span>';
      deleteBtn.onclick = () => window.removeMedia(index);
      wrapper.appendChild(deleteBtn);

      list.appendChild(wrapper);
    });
  }

  function updateTagsDisplay() {
    const container = getElement('moment-tags-display');
    const list = getElement('moment-tags-list');

    if (!container || !list) {
      return;
    }

    if (selectedTags.length === 0) {
      container.classList.add('hidden');
      list.innerHTML = '';
      return;
    }

    container.classList.remove('hidden');
    list.innerHTML = '';

    selectedTags.forEach((tag, index) => {
      const badge = document.createElement('span');
      badge.className = 'badge badge-primary badge-outline gap-1';

      const tagText = document.createElement('span');
      tagText.textContent = `#${tag}`;
      badge.appendChild(tagText);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.className = 'hover:text-error';
      removeBtn.onclick = () => window.removeMomentTag(index);
      badge.appendChild(removeBtn);

      list.appendChild(badge);
    });
  }

  function validateFile(file) {
    if (!file || !(file instanceof File)) {
      return { valid: false, error: '无效的文件' };
    }

    if (isBlockedExtension(file.name)) {
      return { valid: false, error: '禁止上传该类型文件' };
    }

    let category = 'image';
    if (file.type.startsWith('video/')) category = 'video';
    else if (file.type.startsWith('audio/')) category = 'audio';

    return { valid: true, category };
  }

  async function uploadFile(file, category) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/apis/uc.api.storage.halo.run/v1alpha1/attachments/-/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error('文件太大');
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error('无权限上传');
      }
      throw new Error('上传失败');
    }

    const attachment = await response.json();
    let url = attachment.status?.permalink || attachment.spec?.permalink;

    if (!url && attachment.metadata?.name) {
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const checkRes = await fetch(`/api/v1alpha1/attachments/${attachment.metadata.name}`);
        if (checkRes.ok) {
          const updated = await checkRes.json();
          url = updated.status?.permalink || updated.spec?.permalink;
          if (url) {
            break;
          }
        }
      }
    }

    if (!url) {
      throw new Error('未获取到文件地址');
    }

    if (!validateUrl(url)) {
      throw new Error('文件地址不安全');
    }

    let type = 'PHOTO';
    if (category === 'video') type = 'VIDEO';
    else if (category === 'audio') type = 'AUDIO';

    return {
      type,
      url,
      originType: file.type,
      fileName: file.name
    };
  }

  async function publishMoment(content, tags, media) {
    const safeTags = (tags || [])
      .filter((tag) => typeof tag === 'string' && tag.length > 0 && tag.length <= 50)
      .map(sanitizeTag)
      .filter(Boolean)
      .slice(0, 10);

    const safeMedia = (media || []).filter((item) => {
      return item &&
        typeof item.url === 'string' &&
        validateUrl(item.url) &&
        ['PHOTO', 'VIDEO', 'AUDIO', 'POST'].includes(item.type);
    });

    const momentData = {
      apiVersion: 'moment.halo.run/v1alpha1',
      kind: 'Moment',
      metadata: {
        name: `moment-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        labels: { 'moment.halo.run/visible': 'PUBLIC' }
      },
      spec: {
        approved: true,
        approvedTime: new Date().toISOString(),
        content: {
          raw: content.trim(),
          html: escapeHtml(content.trim()).replace(/\n/g, '<br>')
        },
        owner: ownerName,
        visible: 'PUBLIC',
        releaseTime: new Date().toISOString(),
        tags: safeTags
      }
    };

    if (safeMedia.length > 0) {
      momentData.spec.content.medium = safeMedia.map((item) => ({
        type: item.type,
        url: item.url,
        originType: item.originType
      }));
    }

    let response;
    try {
      response = await fetch('/apis/moment.halo.run/v1alpha1/moments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(momentData),
        signal: AbortSignal.timeout(30000)
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('发布超时，请重试');
      }
      throw new Error('网络错误');
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('无权限发布');
      }
      if (response.status === 400) {
        throw new Error('数据格式错误');
      }
      throw new Error('发布失败，请重试');
    }

    return true;
  }

  async function refreshMomentsList() {
    try {
      const response = await fetch(window.location.href);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newList = doc.getElementById('moments-list');
      const currentList = getElement('moments-list');

      if (newList && currentList) {
        currentList.innerHTML = newList.innerHTML;
      }
    } catch (error) {
      console.error('刷新失败:', error);
      window.location.reload();
    }
  }

  function openMomentModal() {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    getElement('moment-content')?.focus();
  }

  function closeMomentModal() {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    window.hideEmojiSelector?.();
    selectedTags = [];
    uploadedMedia = [];
    updateTagsDisplay();
    updateMediaPreview();
  }

  function selectMedia(category) {
    const input = getElement('moment-file-input');
    if (!input) {
      return;
    }

    input.accept = MEDIA_ACCEPTS[category];
    input.setAttribute('data-category', category);
    input.click();
  }

  window.openMomentModal = openMomentModal;
  window.closeMomentModal = closeMomentModal;
  window.selectImages = () => selectMedia('image');
  window.selectVideo = () => selectMedia('video');
  window.selectAudio = () => selectMedia('audio');

  window.handleFileSelect = async function handleFileSelect(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    const publishBtn = getElement('moment-publish-btn');
    const originalHtml = publishBtn?.innerHTML || '发布';

    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.innerHTML = '<span class="loading loading-spinner loading-sm"></span> 上传中...';
    }

    const errors = [];

    try {
      for (const file of files) {
        try {
          const validation = validateFile(file);
          if (!validation.valid) {
            errors.push(`${file.name}: ${validation.error}`);
            continue;
          }

          const media = await uploadFile(file, validation.category);
          if (media) {
            uploadedMedia.push(media);
          }
        } catch (error) {
          errors.push(`${file.name}: ${error.message}`);
        }
      }

      updateMediaPreview();

      if (errors.length > 0) {
        alert(`部分文件上传失败：\n${errors.join('\n')}`);
      }
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败，请重试');
    } finally {
      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.innerHTML = originalHtml;
      }
      event.target.value = '';
    }
  };

  window.removeMedia = function removeMedia(index) {
    uploadedMedia.splice(index, 1);
    updateMediaPreview();
  };

  window.updateCharCount = function updateCharCount(textarea) {
    const counter = getElement('moment-char-count');
    if (!counter) {
      return;
    }

    const count = textarea.value.length;
    counter.textContent = `${count}/1000`;
    counter.classList.toggle('text-error', count > 1000);
  };

  window.toggleTagInput = function toggleTagInput() {
    const row = getElement('moment-tags-input-row');
    const input = getElement('moment-tags');
    if (!row) {
      return;
    }

    if (row.style.display === 'none') {
      row.style.display = 'flex';
      input?.focus();
    } else {
      row.style.display = 'none';
    }
  };

  window.addMomentTag = function addMomentTag() {
    const input = getElement('moment-tags');
    if (!input) {
      return;
    }

    const tag = input.value.trim();
    if (!tag) {
      return;
    }

    if (tag.length > 50) {
      alert('标签长度不能超过 50 个字符');
      return;
    }

    if (selectedTags.length >= 10) {
      alert('最多只能添加 10 个标签');
      return;
    }

    const safeTag = sanitizeTag(tag);
    if (!safeTag) {
      alert('标签包含非法字符');
      return;
    }

    if (!selectedTags.includes(safeTag)) {
      selectedTags.push(safeTag);
      updateTagsDisplay();
    }

    input.value = '';
  };

  window.removeMomentTag = function removeMomentTag(index) {
    selectedTags.splice(index, 1);
    updateTagsDisplay();
  };

  const form = getElement('moment-publish-form');
  const contentInput = getElement('moment-content');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!contentInput) {
      return;
    }

    const publishBtn = getElement('moment-publish-btn');
    const content = contentInput.value.trim();

    if (!content && uploadedMedia.length === 0) {
      alert('请输入内容或上传媒体');
      return;
    }

    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.innerHTML = '<span class="loading loading-spinner loading-sm"></span>';
    }

    try {
      const success = await publishMoment(content, [...selectedTags], [...uploadedMedia]);
      if (success) {
        contentInput.value = '';
        selectedTags = [];
        uploadedMedia = [];
        updateTagsDisplay();
        updateMediaPreview();
        getElement('moment-char-count').textContent = '0/1000';
        getElement('moment-tags').value = '';
        getElement('moment-tags-input-row').style.display = 'none';
        closeMomentModal();
        setTimeout(refreshMomentsList, 500);
      }
    } catch (error) {
      console.error('发布异常:', error);
      alert(`发布失败: ${error.message}`);
    } finally {
      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.textContent = '发布';
      }
    }
  });

  contentInput?.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      if (form?.requestSubmit) {
        form.requestSubmit();
      } else {
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMomentPublishModal, { once: true });
} else {
  initMomentPublishModal();
}
