/**
 * 年会邀请函 H5 - 主逻辑
 * 功能：视频预加载、无缝切换、全流程控制
 */

// ============ 配置区域（替换为你的视频链接） ============
const CONFIG = {
    // 视频1地址（替换为CDN链接）
    video1Url: 'assets/video1.mp4',
    // 视频2地址（替换为CDN链接）  
    video2Url: 'assets/video2.mp4',
};

// ============ DOM 元素 ============
const elements = {
    loadingScreen: document.getElementById('loading-screen'),
    loadingProgress: document.querySelector('.loading-progress'),
    startScreen: document.getElementById('start-screen'),
    startBtn: document.getElementById('start-btn'),
    videoContainer: document.getElementById('video-container'),
    video1: document.getElementById('video1'),
    video2: document.getElementById('video2'),
    continueBtnContainer: document.getElementById('continue-btn-container'),
    continueBtn: document.getElementById('continue-btn'),
    endScreen: document.getElementById('end-screen'),
    replayBtn: document.getElementById('replay-btn'),
};

// ============ 状态管理 ============
const state = {
    video1Loaded: false,
    video2Loaded: false,
    video1CanPlay: false,
    video2CanPlay: false,
};

// ============ 工具函数 ============
function showScreen(screen) {
    // 隐藏所有屏幕
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    // 显示目标屏幕
    screen.classList.remove('hidden');
}

function updateProgress(percent) {
    elements.loadingProgress.textContent = `${Math.round(percent)}%`;
}

// ============ 视频预加载 ============
function preloadVideos() {
    return new Promise((resolve) => {
        let video1Progress = 0;
        let video2Progress = 0;

        // 设置视频源
        elements.video1.src = CONFIG.video1Url;
        elements.video2.src = CONFIG.video2Url;

        // 监听视频1加载进度
        elements.video1.addEventListener('progress', () => {
            if (elements.video1.buffered.length > 0) {
                video1Progress = (elements.video1.buffered.end(0) / elements.video1.duration) * 100;
                updateTotalProgress();
            }
        });

        // 监听视频2加载进度
        elements.video2.addEventListener('progress', () => {
            if (elements.video2.buffered.length > 0) {
                video2Progress = (elements.video2.buffered.end(0) / elements.video2.duration) * 100;
                updateTotalProgress();
            }
        });

        // 视频1可以播放
        elements.video1.addEventListener('canplaythrough', () => {
            state.video1CanPlay = true;
            video1Progress = 100;
            updateTotalProgress();
            checkAllReady();
        }, { once: true });

        // 视频2可以播放
        elements.video2.addEventListener('canplaythrough', () => {
            state.video2CanPlay = true;
            video2Progress = 100;
            updateTotalProgress();
            checkAllReady();
        }, { once: true });

        // 更新总进度
        function updateTotalProgress() {
            // 视频1权重60%，视频2权重40%（优先加载视频1）
            const total = video1Progress * 0.6 + video2Progress * 0.4;
            updateProgress(total);
        }

        // 检查是否全部就绪
        function checkAllReady() {
            if (state.video1CanPlay && state.video2CanPlay) {
                updateProgress(100);
                setTimeout(resolve, 300); // 稍微延迟，让用户看到100%
            }
        }

        // 开始加载
        elements.video1.load();
        elements.video2.load();

        // 超时处理（30秒后如果视频1可播放就继续）
        setTimeout(() => {
            if (state.video1CanPlay) {
                resolve();
            }
        }, 30000);

        // 错误处理
        elements.video1.addEventListener('error', (e) => {
            console.error('视频1加载失败:', e);
            alert('视频加载失败，请刷新页面重试');
        });

        elements.video2.addEventListener('error', (e) => {
            console.error('视频2加载失败:', e);
        });
    });
}

// ============ 播放视频1 ============
function playVideo1() {
    showScreen(elements.videoContainer);
    elements.video1.classList.add('active');
    
    // 播放视频1
    const playPromise = elements.video1.play();
    
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.error('视频1播放失败:', error);
            // 如果自动播放失败，可能需要用户再次交互
        });
    }

    // 监听视频1结束
    elements.video1.addEventListener('ended', onVideo1Ended, { once: true });
}

// ============ 视频1结束处理 ============
function onVideo1Ended() {
    // 暂停在最后一帧（不会黑屏）
    elements.video1.pause();
    
    // 显示继续按钮
    elements.continueBtnContainer.classList.remove('hidden');
}

// ============ 播放视频2（无缝切换） ============
function playVideo2() {
    // 隐藏按钮
    elements.continueBtnContainer.classList.add('hidden');
    
    // 先让视频2准备好，设置为激活状态
    elements.video2.classList.add('active');
    
    // 播放视频2
    const playPromise = elements.video2.play();
    
    if (playPromise !== undefined) {
        playPromise.then(() => {
            // 播放成功后，延迟一点点再隐藏视频1，确保无缝
            setTimeout(() => {
                elements.video1.classList.remove('active');
            }, 50);
        }).catch(error => {
            console.error('视频2播放失败:', error);
        });
    }

    // 监听视频2结束
    elements.video2.addEventListener('ended', onVideo2Ended, { once: true });
}

// ============ 视频2结束处理 ============
function onVideo2Ended() {
    // 暂停视频
    elements.video2.pause();
    
    // 渐变到结束页面
    setTimeout(() => {
        showScreen(elements.endScreen);
    }, 500);
}

// ============ 重新播放 ============
function replay() {
    // 重置视频
    elements.video1.currentTime = 0;
    elements.video2.currentTime = 0;
    elements.video1.classList.add('active');
    elements.video2.classList.remove('active');
    
    // 从视频1开始播放
    playVideo1();
}

// ============ 事件绑定 ============
function bindEvents() {
    // 开始按钮
    elements.startBtn.addEventListener('click', () => {
        playVideo1();
    });

    // 继续按钮
    elements.continueBtn.addEventListener('click', () => {
        playVideo2();
    });

    // 重播按钮
    elements.replayBtn.addEventListener('click', () => {
        replay();
    });
}

// ============ 初始化 ============
async function init() {
    // 绑定事件
    bindEvents();
    
    // 预加载视频
    await preloadVideos();
    
    // 显示开始页面
    showScreen(elements.startScreen);
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
