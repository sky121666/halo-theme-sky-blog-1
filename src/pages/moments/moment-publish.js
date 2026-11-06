import { createModalFocus } from '../../common/js/modal-focus.js';
import { skyDebug } from '../../common/js/debug.js';
import { registerPageLifecycle } from '../../common/js/page-runtime.js';

const BLOCKED_EXTENSIONS = ['.svg', '.html', '.htm', '.js', '.exe', '.bat', '.sh', '.php'];
// Match PluginMoments' official editor limit, including mixed media and earlier batches.
const MAX_MEDIA_COUNT = 9;
const UPLOAD_TIMEOUT_MS = 300000;

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

  const controller = new AbortController();
  const { signal } = controller;
  const refreshStatus = getElement('moments-refresh-status');
  const refreshRetry = getElement('moments-refresh-retry');
  const publishStatus = getElement('moments-publish-status');
  const permissionStatus = getElement('moment-permission-status');
  const permissionMessage = getElement('moment-permission-message');
  const permissionRetry = getElement('moment-permission-retry');
  let selectedTags = [];
  let uploadedMedia = [];
  let refreshTimer = null;
  let statusTimer = null;
  let refreshVersion = 0;
  let isRefreshing = false;
  let isPublishing = false;
  let canPublish = false;
  let permissionState = 'idle';
  let permissionRetrying = false;
  let modalSession = 0;
  let activeUpload = null;
  const focus = createModalFocus({
    panel: modal, signal, onClose: closeMomentModal,
    initialFocus: () => getElement('moment-content'),
  });

  function syncPublishControls() {
    document.querySelectorAll('[data-moment-publish-trigger]').forEach((button) => {
      button.classList.toggle('hidden', !canPublish);
      button.disabled = !canPublish;
    });
    const showRetry = permissionState === 'error' || (permissionState === 'checking' && permissionRetrying);
    permissionStatus?.classList.toggle('hidden', !showRetry);
    if (permissionMessage) {
      permissionMessage.textContent = permissionState === 'error'
        ? '暂时无法确认发布权限，请重试。' : showRetry ? '正在重试…' : '';
    }
    if (permissionRetry) {
      permissionRetry.classList.toggle('hidden', !showRetry);
      permissionRetry.disabled = permissionState === 'checking';
    }
  }

  async function loadPublishPermission() {
    if (signal.aborted || permissionState === 'checking') return;
    permissionRetrying = permissionState === 'error';
    permissionState = 'checking';
    canPublish = false;
    syncPublishControls();
    try {
      // Halo WebFlux 的 #authorization 仅支持登录状态；UI 权限由当前用户权限接口提供。
      const response = await fetch('/apis/api.console.halo.run/v1alpha1/users/-/permissions', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        cache: 'no-store',
      });
      if (signal.aborted) return;
      if ([401, 403].includes(response.status)) {
        permissionState = 'denied';
        syncPublishControls();
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const permissions = (await response.json()).uiPermissions;
      if (signal.aborted) return;
      if (!Array.isArray(permissions)) throw new Error('Invalid UI permissions response');
      canPublish = permissions.includes('*') || permissions.includes('uc:plugin:moments:publish');
      permissionState = canPublish ? 'allowed' : 'denied';
      syncPublishControls();
    } catch (error) {
      if (signal.aborted) return;
      permissionState = 'error';
      syncPublishControls();
      skyDebug.warn('moment-publish', '无法确认发布权限', error);
    }
  }

  function finishUpload(upload) {
    if (activeUpload !== upload) return;
    activeUpload = null;
    upload.input.value = '';
    if (upload.button && !signal.aborted) {
      upload.button.disabled = false;
      upload.button.removeAttribute('aria-busy');
      upload.button.innerHTML = upload.originalHtml;
    }
  }

  function cancelUpload() {
    if (!activeUpload) return;
    const upload = activeUpload;
    upload.controller.abort();
    finishUpload(upload);
  }

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

  async function uploadFile(file, category, uploadSignal) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/apis/uc.api.storage.halo.run/v1alpha1/attachments/-/upload', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.any([signal, uploadSignal, AbortSignal.timeout(UPLOAD_TIMEOUT_MS)]),
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
    // Halo 2.27's UC handler resolves the permalink before returning the attachment.
    const url = attachment.status?.permalink;

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
    if (media?.length > MAX_MEDIA_COUNT) {
      throw new Error(`最多允许添加 ${MAX_MEDIA_COUNT} 个附件`);
    }
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
        name: `moment-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      },
      spec: {
        content: {
          raw: content.trim(),
          html: escapeHtml(content.trim()).replace(/\n/g, '<br>')
        },
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
      response = await fetch('/apis/uc.api.moment.halo.run/v1alpha1/moments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(momentData),
        signal: AbortSignal.any([signal, AbortSignal.timeout(30000)])
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('发布超时，请重试', { cause: error });
      }
      throw new Error('网络错误', { cause: error });
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

    // POST 已被接受；响应体异常不能误报为发布失败而诱导用户重复提交。
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  async function refreshMomentsList(version) {
    if (signal.aborted || version !== refreshVersion) return;
    isRefreshing = true;
    if (refreshRetry) {
      refreshRetry.disabled = true;
      refreshRetry.setAttribute('aria-busy', 'true');
    }

    try {
      const response = await fetch(window.location.href, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      if (signal.aborted || version !== refreshVersion) return;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newList = doc.getElementById('moments-list');
      const currentList = getElement('moments-list');

      if (newList && currentList) {
        currentList.innerHTML = newList.innerHTML;
        syncPublishControls();
        document.dispatchEvent(new Event('sky:moments-list-refreshed'));
        refreshStatus?.classList.add('hidden');
        publishStatus?.classList.remove('hidden');
        window.clearTimeout(statusTimer);
        statusTimer = window.setTimeout(() => {
          if (!signal.aborted && version === refreshVersion) publishStatus?.classList.add('hidden');
        }, 4000);
      } else {
        throw new Error('未找到瞬间列表');
      }
    } catch (error) {
      if (signal.aborted || version !== refreshVersion) return;
      skyDebug.error('moment-publish', '刷新失败', error);
      publishStatus?.classList.add('hidden');
      refreshStatus?.classList.remove('hidden');
    } finally {
      if (!signal.aborted && version === refreshVersion) {
        isRefreshing = false;
        if (refreshRetry) {
          refreshRetry.disabled = false;
          refreshRetry.removeAttribute('aria-busy');
        }
      }
    }
  }

  function openMomentModal() {
    if (!canPublish) return;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    focus.open();
  }

  function closeMomentModal(options) {
    modalSession += 1;
    cancelUpload();
    modal.classList.add('hidden');
    modal.style.display = 'none';
    window.hideEmojiSelector?.();
    focus.close(options);
    selectedTags = [];
    uploadedMedia = [];
    updateTagsDisplay();
    updateMediaPreview();
  }

  function selectMedia(category) {
    if (!canPublish || isPublishing || getElement('moment-publish-btn')?.disabled) return;
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
    if (!canPublish || isPublishing || publishBtn?.disabled) {
      event.target.value = '';
      return;
    }
    if (uploadedMedia.length + files.length > MAX_MEDIA_COUNT) {
      alert(`最多允许添加 ${MAX_MEDIA_COUNT} 个附件，当前已添加 ${uploadedMedia.length} 个。请重新选择。`);
      event.target.value = '';
      return;
    }
    const uploadSession = modalSession;
    const upload = {
      controller: new AbortController(), input: event.target, button: publishBtn,
      originalHtml: publishBtn?.innerHTML || '发布',
    };
    activeUpload = upload;

    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.setAttribute('aria-busy', 'true');
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

          const media = await uploadFile(file, validation.category, upload.controller.signal);
          if (signal.aborted || uploadSession !== modalSession) return;
          if (media) {
            uploadedMedia.push(media);
          }
        } catch (error) {
          if (signal.aborted || uploadSession !== modalSession) return;
          errors.push(`${file.name}: ${error.name === 'TimeoutError' ? '上传超时，请重试' : error.message}`);
        }
      }

      if (signal.aborted || uploadSession !== modalSession) return;
      updateMediaPreview();

      if (errors.length > 0) {
        alert(`部分文件上传失败：\n${errors.join('\n')}`);
      }
    } catch (error) {
      if (signal.aborted || uploadSession !== modalSession) return;
      skyDebug.error('moment-publish', '上传失败', error);
      alert('上传失败，请重试');
    } finally {
      finishUpload(upload);
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
      return true;
    }

    const tag = input.value.trim();
    if (!tag) {
      return true;
    }

    if (tag.length > 50) {
      alert('标签长度不能超过 50 个字符');
      return false;
    }

    const safeTag = sanitizeTag(tag);
    if (!safeTag) {
      alert('标签包含非法字符');
      return false;
    }

    if (!selectedTags.includes(safeTag)) {
      if (selectedTags.length >= 10) {
        alert('最多只能添加 10 个标签');
        return false;
      }
      selectedTags.push(safeTag);
      updateTagsDisplay();
    }

    input.value = '';
    return true;
  };

  window.removeMomentTag = function removeMomentTag(index) {
    selectedTags.splice(index, 1);
    updateTagsDisplay();
  };

  const form = getElement('moment-publish-form');
  const contentInput = getElement('moment-content');

  function snapshotDraft() {
    return JSON.stringify({
      content: contentInput?.value || '',
      tags: selectedTags,
      tagInput: getElement('moment-tags')?.value || '',
      media: uploadedMedia,
    });
  }

  refreshRetry?.addEventListener('click', () => {
    if (signal.aborted || isRefreshing) return;
    window.clearTimeout(refreshTimer);
    refreshMomentsList(++refreshVersion);
  }, { signal });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!contentInput || !canPublish || isPublishing) {
      return;
    }

    const publishBtn = getElement('moment-publish-btn');
    if (publishBtn?.disabled) return;
    const content = contentInput.value.trim();

    if (!content && uploadedMedia.length === 0) {
      alert('请输入内容或上传媒体');
      return;
    }
    if (!window.addMomentTag()) return;

    // A new submission owns the result area; older refreshes cannot replace its feedback.
    window.clearTimeout(refreshTimer);
    window.clearTimeout(statusTimer);
    ++refreshVersion;
    isRefreshing = false;
    publishStatus?.classList.add('hidden');
    refreshStatus?.classList.add('hidden');
    const submitSession = modalSession;
    const submittedDraft = snapshotDraft();
    isPublishing = true;
    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.setAttribute('aria-busy', 'true');
      publishBtn.innerHTML = '<span class="loading loading-spinner loading-sm" aria-hidden="true"></span> 发布中...';
    }

    try {
      const moment = await publishMoment(content, [...selectedTags], [...uploadedMedia]);
      if (signal.aborted) return;
      const isPublic = moment?.spec?.approved === true && moment.spec.visible === 'PUBLIC';
      const resultMessage = isPublic ? '瞬间已公开发布。'
        : moment?.spec?.approved === false ? '瞬间已提交，待审核后公开。'
          : moment?.spec?.approved === true ? '瞬间已提交，当前未公开。'
            : '瞬间已提交，发布状态暂未确认，请前往用户中心查看。';
      if (publishStatus) {
        publishStatus.textContent = resultMessage;
        publishStatus.classList.remove('hidden');
      }
      if (submitSession === modalSession && submittedDraft === snapshotDraft()) {
        contentInput.value = '';
        selectedTags = [];
        uploadedMedia = [];
        updateTagsDisplay();
        updateMediaPreview();
        getElement('moment-char-count').textContent = '0/1000';
        getElement('moment-tags').value = '';
        getElement('moment-tags-input-row').style.display = 'none';
        closeMomentModal();
      } else if (submitSession === modalSession) {
        alert(`${resultMessage} 当前编辑已保留。`);
      }
      if (isPublic) {
        window.clearTimeout(refreshTimer);
        const version = ++refreshVersion;
        refreshTimer = window.setTimeout(() => refreshMomentsList(version), 500);
      }
    } catch (error) {
      if (signal.aborted) return;
      skyDebug.error('moment-publish', '发布异常', error);
      const subject = submitSession === modalSession ? '发布失败' : '之前提交的瞬间发布失败';
      alert(`${subject}: ${error.message}`);
    } finally {
      isPublishing = false;
      if (publishBtn && !signal.aborted) {
        publishBtn.disabled = false;
        publishBtn.removeAttribute('aria-busy');
        publishBtn.textContent = '发布';
      }
    }
  }, { signal });

  contentInput?.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      if (form?.requestSubmit) {
        form.requestSubmit();
      } else {
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }
  }, { signal });

  const globalBindings = {
    openMomentModal: window.openMomentModal,
    closeMomentModal: window.closeMomentModal,
    selectImages: window.selectImages,
    selectVideo: window.selectVideo,
    selectAudio: window.selectAudio,
    handleFileSelect: window.handleFileSelect,
    removeMedia: window.removeMedia,
    updateCharCount: window.updateCharCount,
    toggleTagInput: window.toggleTagInput,
    addMomentTag: window.addMomentTag,
    removeMomentTag: window.removeMomentTag,
    showEmojiSelector: window.showEmojiSelector,
    hideEmojiSelector: window.hideEmojiSelector,
  };

  permissionRetry?.addEventListener('click', loadPublishPermission, { signal });
  syncPublishControls();
  loadPublishPermission();

  return () => {
    controller.abort();
    cancelUpload();
    window.clearTimeout(refreshTimer);
    window.clearTimeout(statusTimer);
    modal.dataset.initialized = 'false';
    Object.entries(globalBindings).forEach(([name, handler]) => {
      if (window[name] === handler) window[name] = undefined;
    });
  };
}

registerPageLifecycle(initMomentPublishModal, { entry: 'moments' });
