/**
 * 2026年会邀请函 - 视频播放控制
 * 核心策略：timeupdate + ended 双重检测，状态机管理
 */

// ============ 配置 ============
const CONFIG = {
    video1Url: 'https://weiya-h5-1400603784.cos.ap-guangzhou.myqcloud.com/assets/video1.mp4',
    video2Url: 'https://weiya-h5-1400603784.cos.ap-guangzhou.myqcloud.com/assets/video2.mp4',
    endBgUrl: 'https://weiya-h5-1400603784.cos.ap-guangzhou.myqcloud.com/assets/end-bg.png',  // 结束页背景图
    endDelayMs: 2000,  // 视频2结束后延迟切换时间
};

// ============ 状态机 ============
const State = {
    LOADING: 'loading',
    START: 'start',
    PLAYING_V1: 'playing_v1',
    WAITING: 'waiting',
    PLAYING_V2: 'playing_v2',
    END: 'end'
};

let currentState = State.LOADING;
let cleanupFn = null;  // 当前视频的事件清理函数

// ============ DOM 元素 ============
const $ = function(id) { return document.getElementById(id); };
const elements = {
    loadingScreen: $('loading-screen'),
    startScreen: $('start-screen'),
    videoContainer: $('video-container'),
    endScreen: $('end-screen'),
    startVideo: $('start-video'),
    video1: $('video1'),
    video2: $('video2'),
    endBg: $('end-bg'),
    continueBtn: $('continue-btn-container'),
    progress: document.querySelector('.loading-progress'),
};

// ============ 工具函数 ============
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(function(s) { s.classList.add('hidden'); });
    screen.classList.remove('hidden');
}

function updateProgress(percent) {
    elements.progress.textContent = Math.round(percent) + '%';
}

function log(msg) {
    console.log('[' + currentState + '] ' + msg);
}

// ============ 视频播放完成检测器（核心） ============
function createVideoEndDetector(video, onComplete) {
    var completed = false;
    var lastTime = -1;
    var stuckCount = 0;
    
    var tryComplete = function(source) {
        if (completed) return;
        completed = true;
        log('视频播放完成 (来源: ' + source + ')');
        video.pause();
        // 清理事件
        cleanup();
        onComplete();
    };
    
    // 主检测：timeupdate - 检查是否接近结尾
    var onTimeUpdate = function() {
        if (completed) return;
        var duration = video.duration;
        var current = video.currentTime;
        
        // 防止 duration 为 NaN 或 0
        if (!duration || duration <= 0) return;
        
        // 当播放位置接近结尾时（剩余不到0.5秒）
        if (current >= duration - 0.5) {
            tryComplete('timeupdate');
            return;
        }
        
        // 检测是否卡住（播放位置长时间不变）
        if (current === lastTime) {
            stuckCount++;
            if (stuckCount > 10 && current >= duration - 1) {
                tryComplete('stuck');
            }
        } else {
            stuckCount = 0;
            lastTime = current;
        }
    };
    
    // 备用检测：ended 事件
    var onEnded = function() {
        tryComplete('ended');
    };
    
    // 额外保险：播放暂停且接近结尾
    var onPause = function() {
        if (completed) return;
        var duration = video.duration;
        var current = video.currentTime;
        if (duration > 0 && current >= duration - 0.5) {
            tryComplete('pause');
        }
    };
    
    // 绑定事件
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('pause', onPause);
    
    // 清理函数
    var cleanup = function() {
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('pause', onPause);
    };
    
    return cleanup;
}

// ============ 状态切换 ============
function setState(newState) {
    log('状态切换: ' + currentState + ' -> ' + newState);
    
    // 清理上一个状态的事件监听
    if (cleanupFn) {
        cleanupFn();
        cleanupFn = null;
    }
    
    currentState = newState;
    
    switch (newState) {
        case State.START:
            showScreen(elements.startScreen);
            break;
            
        case State.PLAYING_V1:
            showScreen(elements.videoContainer);
            elements.continueBtn.classList.add('hidden');
            elements.video1.classList.add('active');
            elements.video1.currentTime = 0;
            elements.video1.play().then(function() {
                log('视频1开始播放');
            }).catch(function(e) {
                log('视频1播放失败: ' + e.message);
            });
            // 设置完成检测
            cleanupFn = createVideoEndDetector(elements.video1, function() {
                setState(State.WAITING);
            });
            break;
            
        case State.WAITING:
            elements.video1.pause();
            elements.continueBtn.classList.remove('hidden');
            log('等待用户点击继续');
            break;
            
        case State.PLAYING_V2:
            elements.continueBtn.classList.add('hidden');
            elements.video2.currentTime = 0;
            elements.video2.classList.add('active');
            elements.video2.play().then(function() {
                log('视频2开始播放');
                // 播放成功后再隐藏视频1
                setTimeout(function() {
                    elements.video1.classList.remove('active');
                }, 100);
            }).catch(function(e) {
                log('视频2播放失败: ' + e.message);
            });
            // 设置完成检测
            cleanupFn = createVideoEndDetector(elements.video2, function() {
                log('视频2播放完成，' + CONFIG.endDelayMs + 'ms 后切换到结束页面');
                setTimeout(function() {
                    setState(State.END);
                }, CONFIG.endDelayMs);
            });
            break;
            
        case State.END:
            elements.video2.pause();
            showScreen(elements.endScreen);
            break;
    }
}

// ============ 预加载 ============
function preload() {
    return new Promise(function(resolve) {
        var video1Ready = false;
        var progress1 = 0;
        
        // 设置视频源
        elements.startVideo.src = CONFIG.video1Url;
        elements.video1.src = CONFIG.video1Url;
        elements.video2.src = CONFIG.video2Url;
        
        // 设置结束页背景图
        elements.endBg.src = CONFIG.endBgUrl;
        
        // 开始页面视频：加载后暂停在首帧
        elements.startVideo.addEventListener('loadeddata', function() {
            elements.startVideo.currentTime = 0;
            elements.startVideo.pause();
            log('开始页面背景视频已加载');
        }, { once: true });
        
        // 通用进度更新函数
        var updateVideoProgress = function() {
            var video = elements.video1;
            if (video.buffered.length > 0 && isFinite(video.duration) && video.duration > 0) {
                var bufferedEnd = video.buffered.end(video.buffered.length - 1);
                progress1 = (bufferedEnd / video.duration) * 100;
                updateProgress(Math.min(progress1, 99)); // 最多99%，100%由canplaythrough触发
            }
        };
        
        // 多事件源更新进度
        elements.video1.addEventListener('loadedmetadata', function() {
            log('视频1元数据已加载，时长: ' + elements.video1.duration + '秒');
            updateVideoProgress();
        });
        elements.video1.addEventListener('progress', updateVideoProgress);
        elements.video1.addEventListener('loadeddata', function() {
            updateVideoProgress();
            if (progress1 < 30) updateProgress(30); // 保底30%
        });
        elements.video1.addEventListener('canplay', function() {
            updateVideoProgress();
            if (progress1 < 80) updateProgress(80); // 保底80%
        });
        
        // 视频1可播放
        elements.video1.addEventListener('canplaythrough', function() {
            if (!video1Ready) {
                video1Ready = true;
                updateProgress(100);
                log('视频1加载完成');
                setTimeout(resolve, 300);
            }
        }, { once: true });
        
        // 开始加载
        elements.startVideo.load();
        elements.video1.load();
        elements.video2.load();
        
        // 超时处理
        setTimeout(function() {
            if (!video1Ready && elements.video1.readyState >= 3) {
                video1Ready = true;
                resolve();
            }
        }, 30000);
    });
}

// ============ 事件绑定 ============
function bindEvents() {
    // 开始按钮
    $('start-btn').onclick = function() {
        if (currentState === State.START) {
            setState(State.PLAYING_V1);
        }
    };
    
    // 继续按钮
    $('continue-btn').onclick = function() {
        if (currentState === State.WAITING) {
            setState(State.PLAYING_V2);
        }
    };
    
    // 重播按钮
    $('replay-btn').onclick = function() {
        if (currentState === State.END) {
            // 重置视频状态
            elements.video1.currentTime = 0;
            elements.video2.currentTime = 0;
            elements.video1.classList.add('active');
            elements.video2.classList.remove('active');
            setState(State.PLAYING_V1);
        }
    };
}

// ============ 初始化 ============
function init() {
    log('初始化开始');
    bindEvents();
    preload().then(function() {
        setState(State.START);
        log('初始化完成');
    });
}

// 启动
init();
