/**
 * 2026年会邀请函 - 视频播放控制
 * 核心策略：timeupdate + ended 双重检测，状态机管理，平滑进度显示
 */

// ============ 配置 ============
const CONFIG = {
    video1Url: 'https://weiya-h5-1400603784.cos.ap-guangzhou.myqcloud.com/assets/video1.mp4',
    video2Url: 'https://weiya-h5-1400603784.cos.ap-guangzhou.myqcloud.com/assets/video2.mp4',
    endBgUrl: 'https://weiya-h5-1400603784.cos.ap-guangzhou.myqcloud.com/assets/end-bg.png',
    endDelayMs: 1000,
    // 进度条配置
    minLoadingTime: 1500,      // 最小加载时间（毫秒）
    simulateMaxProgress: 80,   // 模拟进度最大值
    simulateInterval: 50,      // 模拟进度更新间隔（毫秒）
    simulateStep: 2,           // 每次增加的进度值
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
    fadeOverlay: $('fade-overlay'),
    bgMusic: $('bg-music'),
    musicBtn: $('music-btn'),
};

// ============ 音乐控制 ============
var isMuted = false;
var musicPlaying = false;  // 标记音乐是否已成功播放
var originalVolume = 1.0;  // 原始音量
var lowVolume = 0.15;      // 低音量（视频播放时）

function tryPlayMusic() {
    if (musicPlaying) return;  // 已经在播放了，不重复操作
    
    if (elements.bgMusic) {
        elements.bgMusic.volume = originalVolume;
        elements.bgMusic.play().then(function() {
            musicPlaying = true;
            log('背景音乐开始播放');
            showMusicBtn();
        }).catch(function(e) {
            log('背景音乐自动播放失败: ' + e.message);
        });
    }
}

function lowerMusicVolume() {
    if (elements.bgMusic && !elements.bgMusic.paused) {
        // 平滑降低音量
        var currentVol = elements.bgMusic.volume;
        var fadeInterval = setInterval(function() {
            currentVol -= 0.05;
            if (currentVol <= lowVolume) {
                elements.bgMusic.volume = lowVolume;
                clearInterval(fadeInterval);
                log('背景音乐音量已调低至: ' + lowVolume);
            } else {
                elements.bgMusic.volume = currentVol;
            }
        }, 50);
    }
}

function stopMusic() {
    if (elements.bgMusic) {
        elements.bgMusic.pause();
        elements.bgMusic.currentTime = 0;
        musicPlaying = false;
        log('背景音乐已停止');
    }
    // 隐藏音乐按钮
    if (elements.musicBtn) {
        elements.musicBtn.classList.remove('show');
    }
}

function showMusicBtn() {
    if (elements.musicBtn) {
        elements.musicBtn.classList.add('show');
    }
}

function initMusicAutoPlay() {
    // ====== 核心方案：微信环境自动播放 ======
    // 方案1：WeixinJSBridge 已存在（页面加载较慢的情况）
    if (typeof WeixinJSBridge !== 'undefined') {
        log('WeixinJSBridge 已存在，尝试通过 getNetworkType 触发播放');
        WeixinJSBridge.invoke('getNetworkType', {}, function(res) {
            log('getNetworkType 回调触发，网络类型: ' + res.networkType);
            tryPlayMusic();
        });
    }
    
    // 方案2：监听 WeixinJSBridgeReady 事件（页面加载较快的情况）
    document.addEventListener('WeixinJSBridgeReady', function() {
        log('WeixinJSBridgeReady 事件触发');
        tryPlayMusic();
    }, false);
    
    // 方案3：使用 wx.ready（如果引入了微信 JS-SDK）
    if (typeof wx !== 'undefined' && wx.ready) {
        wx.ready(function() {
            log('wx.ready 触发');
            tryPlayMusic();
        });
    }
    
    // ====== 备用方案：非微信环境 ======
    // 尝试直接播放（某些安卓浏览器可能支持）
    setTimeout(function() {
        if (!musicPlaying) {
            log('尝试直接自动播放');
            tryPlayMusic();
        }
    }, 100);
    
    // 监听音频 canplaythrough 事件
    if (elements.bgMusic) {
        elements.bgMusic.addEventListener('canplaythrough', function() {
            log('音频 canplaythrough 事件触发');
            tryPlayMusic();
        }, { once: true });
    }
    
    // ====== 最终兜底：用户交互触发 ======
    var playOnInteraction = function() {
        if (musicPlaying) return;
        log('用户交互触发播放');
        tryPlayMusic();
    };
    document.addEventListener('touchstart', playOnInteraction, { once: true });
    document.addEventListener('click', playOnInteraction, { once: true });
}

function bindMusicEvents() {
    // 音乐按钮点击事件
    if (elements.musicBtn) {
        elements.musicBtn.onclick = function() {
            isMuted = !isMuted;
            elements.bgMusic.muted = isMuted;
            elements.musicBtn.querySelector('.music-icon').textContent = isMuted ? '🔇' : '🔊';
            log('音乐静音状态: ' + isMuted);
        };
    }
    
    // 立即初始化自动播放
    initMusicAutoPlay();
}

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
            // 音乐应该在加载阶段就已经开始播放了，这里不需要再操作
            break;
            
        case State.PLAYING_V1:
            // 调低背景音乐音量（而不是停止）
            lowerMusicVolume();
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
                log('视频2播放完成，开始淡出过渡');
                // 淡出（显示黑色遮罩）
                elements.fadeOverlay.classList.add('active');
                // 等待淡出完成后切换页面
                setTimeout(function() {
                    setState(State.END);
                    // 淡入（隐藏黑色遮罩）
                    setTimeout(function() {
                        elements.fadeOverlay.classList.remove('active');
                    }, 100);
                }, 500); // 500ms 淡出时间
            });
            break;
            
        case State.END:
            elements.video2.pause();
            showScreen(elements.endScreen);
            break;
    }
}

// ============ 预加载（平滑进度版） ============
function preload() {
    return new Promise(function(resolve) {
        var videoReady = false;        // 视频是否真正准备好
        var simulatedProgress = 0;     // 模拟进度值
        var displayProgress = 0;       // 当前显示的进度值
        var simulateTimer = null;      // 模拟进度定时器
        var startTime = Date.now();    // 开始加载时间
        
        // 完成加载的函数
        var completeLoading = function(source) {
            if (simulateTimer) {
                clearInterval(simulateTimer);
                simulateTimer = null;
            }
            
            // 快速完成剩余进度（从当前进度到100%）
            var finalProgress = displayProgress;
            var finishAnimation = function() {
                finalProgress += 5;
                if (finalProgress >= 100) {
                    updateProgress(100);
                    log('加载完成 (来源: ' + source + ')');
                    setTimeout(resolve, 200);
                } else {
                    updateProgress(finalProgress);
                    requestAnimationFrame(finishAnimation);
                }
            };
            finishAnimation();
        };
        
        // 检查是否可以完成
        var tryComplete = function(source) {
            var elapsed = Date.now() - startTime;
            
            // 必须同时满足：1.视频准备好 2.已过最小加载时间
            if (videoReady && elapsed >= CONFIG.minLoadingTime) {
                completeLoading(source);
            } else if (videoReady) {
                // 视频准备好了但时间不够，等时间到
                log('视频已准备好，等待最小加载时间...');
            }
        };
        
        // 启动模拟进度
        simulateTimer = setInterval(function() {
            if (simulatedProgress < CONFIG.simulateMaxProgress) {
                // 进度越高，增长越慢
                var step = CONFIG.simulateStep;
                if (simulatedProgress > 50) step = 1;
                if (simulatedProgress > 70) step = 0.5;
                
                simulatedProgress = Math.min(simulatedProgress + step, CONFIG.simulateMaxProgress);
                displayProgress = simulatedProgress;
                updateProgress(displayProgress);
            }
            
            // 检查是否可以完成
            if (videoReady) {
                tryComplete('simulated');
            }
        }, CONFIG.simulateInterval);
        
        // 设置视频源
        elements.startVideo.src = CONFIG.video1Url;
        elements.video1.src = CONFIG.video1Url;
        elements.video2.src = CONFIG.video2Url;
        elements.endBg.src = CONFIG.endBgUrl;
        
        // 开始页面视频
        elements.startVideo.addEventListener('loadeddata', function() {
            elements.startVideo.currentTime = 0;
            elements.startVideo.pause();
            log('开始页面背景视频已加载');
        }, { once: true });
        
        // 视频加载事件
        elements.video1.addEventListener('loadedmetadata', function() {
            log('视频1元数据已加载，时长: ' + elements.video1.duration + '秒');
        });
        
        elements.video1.addEventListener('canplay', function() {
            log('视频1 canplay 触发');
            videoReady = true;
            tryComplete('canplay');
        });
        
        elements.video1.addEventListener('canplaythrough', function() {
            log('视频1 canplaythrough 触发');
            videoReady = true;
            tryComplete('canplaythrough');
        }, { once: true });
        
        // 开始加载
        elements.startVideo.load();
        elements.video1.load();
        elements.video2.load();
        
        // 最小加载时间到了，检查是否可以完成
        setTimeout(function() {
            log('最小加载时间已到');
            if (videoReady) {
                tryComplete('mintime');
            }
        }, CONFIG.minLoadingTime);
        
        // iOS 微信兼容：3秒检查
        setTimeout(function() {
            if (!videoReady) {
                var readyState = elements.video1.readyState;
                log('3秒检查: readyState=' + readyState);
                if (readyState >= 2) {
                    videoReady = true;
                    tryComplete('timeout-ready');
                }
            }
        }, 3000);
        
        // 5秒强制进入
        setTimeout(function() {
            if (!videoReady || displayProgress < 100) {
                log('5秒超时，强制完成');
                videoReady = true;
                completeLoading('timeout-force');
            }
        }, 5000);
        
        // 最终保底
        setTimeout(function() {
            if (displayProgress < 100) {
                videoReady = true;
                completeLoading('timeout-final');
            }
        }, 10000);
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
    log('初始化开始 (平滑进度版)');
    bindEvents();
    bindMusicEvents();
    preload().then(function() {
        setState(State.START);
        log('初始化完成');
    });
}

// 启动
init();
