/**
 * Intendex Tracker Script
 * 
 * 광고주 웹사이트의 <head> 태그에 삽입하기 위한 바닐라 자바스크립트 트래킹 코드입니다.
 * 사용자가 화면을 주시한 실제 누적 시간(활성 시간)이 지정된 목표 시간(예: 20초)에 도달하면
 * Intendex 시스템으로 확정 Ping을 보냅니다.
 */
(function(window, document) {
  // 중복 실행 방지
  if (window.IntendexTracker) return;

  const Tracker = {
    // 설정값
    config: {
      targetSeconds: 20, // 목표 체류 시간 (초)
      transactionId: null, // 초기화 시점에 주입받을 거래 ID
      verifyEndpoint: "http://localhost:4000/api/sla/verify", // 전송될 엔드포인트
    },
    
    // 상태값
    state: {
      isTracking: false,
      isCompleted: false, // 달성 여부
      accumulatedTime: 0, // 누적 시간 (밀리초)
      lastStartTime: 0,   // 측정을 시작/재개한 시점 (밀리초)
      timerId: null,
    },

    /**
     * 트래커 초기화 및 측정 시작
     */
    init: function(options) {
      if (options && options.transactionId) {
        this.config.transactionId = options.transactionId;
      }
      if (options && options.verifyEndpoint) {
        this.config.verifyEndpoint = options.verifyEndpoint;
      }
      
      if (!this.config.transactionId) {
        console.warn("[Intendex] Tracker requires a valid transactionId.");
        return;
      }

      this.bindEvents();
      this.startTracking();
      window.IntendexTracker = this;
      console.log("[Intendex] Tracker initialized. Target: 20s");
    },

    /**
     * 포커스 및 Visibility 이벤트 바인딩
     */
    bindEvents: function() {
      // 탭 전환, 브라우저 최소화 등 Visibility 상태 변경 감지
      document.addEventListener("visibilitychange", this.handleVisibilityChange.bind(this));
      
      // 페이지를 떠나거나 닫을 때 남은 시간을 정산하고, 조건이 되면 안전하게 데이터를 보냄
      window.addEventListener("beforeunload", this.handleUnload.bind(this));
    },

    /**
     * Visibility 변화에 따른 타이머 정지/재개
     */
    handleVisibilityChange: function() {
      if (document.visibilityState === "hidden") {
        this.pauseTracking();
      } else if (document.visibilityState === "visible") {
        this.startTracking();
      }
    },

    /**
     * 사용자가 창을 닫을 때 데이터 유실 방지
     */
    handleUnload: function() {
      // 컴플리트 전 창을 닫는다면 마지막으로 누적 시간을 정산
      if (!this.state.isCompleted) {
        this.pauseTracking(); 
        
        // 만약 닫는 시점의 누적시간이 20초를 넘었다면 (통신 딜레이 등으로 처리가 안 됐을 경우)
        if (this.state.accumulatedTime >= this.config.targetSeconds * 1000) {
          this.sendPing(true); // sendBeacon 강제 사용
        }
      }
    },

    /**
     * 유효 체류 시간 측정 시작 (시작점 마킹)
     */
    startTracking: function() {
      if (this.state.isCompleted || this.state.isTracking) return;
      
      this.state.isTracking = true;
      this.state.lastStartTime = Date.now();
      
      // 주기적으로 목표 시간에 도달했는지 확인 (1초마다)
      this.state.timerId = setInterval(() => {
        this.checkGoal();
      }, 1000);
    },

    /**
     * 측정 일시 정지 (누적 시간 결산)
     */
    pauseTracking: function() {
      if (!this.state.isTracking) return;
      
      clearInterval(this.state.timerId);
      
      const now = Date.now();
      this.state.accumulatedTime += (now - this.state.lastStartTime);
      this.state.isTracking = false;
    },

    /**
     * SLA 조건 도달 검증
     */
    checkGoal: function() {
      const now = Date.now();
      const currentSessionTime = now - this.state.lastStartTime;
      const totalTime = this.state.accumulatedTime + currentSessionTime;

      // 누적 시간이 목표치(20초) 이상일 경우
      if (totalTime >= this.config.targetSeconds * 1000) {
        this.completeTracking(totalTime);
      }
    },

    /**
     * 조건 달성 처리 (1회성)
     */
    completeTracking: function(totalTime) {
      if (this.state.isCompleted) return;
      
      clearInterval(this.state.timerId);
      this.state.isTracking = false;
      this.state.isCompleted = true;
      this.state.accumulatedTime = totalTime;

      console.log(`[Intendex] Goal reached! Active Time: ${(totalTime/1000).toFixed(1)}s. Sending ping...`);
      this.sendPing(false);
    },

    /**
     * 백엔드로 검증 핑 전송 (Beacon API 또는 Fetch)
     */
    sendPing: function(useBeacon) {
      const payload = JSON.stringify({
        transactionId: this.config.transactionId,
        accumulatedTimeMs: this.state.accumulatedTime,
        timestamp: Date.now()
      });

      // 페이지가 닫히거나 이동 중일 때(unload)는 비동기 취소를 막기 위해 sendBeacon 사용
      if (useBeacon && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        const queued = navigator.sendBeacon(this.config.verifyEndpoint, blob);
        
        if (queued) {
          console.log("[Intendex] Payload queued successfully via sendBeacon.");
          return;
        }
        // sendBeacon 실패 시 fetch keepalive 폴백
      }

      // 일반적인 상황에서의 Fetch
      if (window.fetch) {
        fetch(this.config.verifyEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: payload,
          keepalive: true // 페이지 이동 중에도 요청을 이어가기 위함
        }).then(response => {
          if (!response.ok) throw new Error("Network response was not ok");
          console.log("[Intendex] Verification payload delivered.");
        }).catch(err => {
          console.error("[Intendex] Failed to deliver payload:", err);
        });
      }
    }
  };

  // 자동 실행 처리 (광고주가 스크립트 태그 속성으로 transactionId를 넘기는 방식일 경우)
  // 예: <script src="tracker.js" data-transaction-id="12345"></script>
  const scriptTag = document.currentScript;
  if (scriptTag) {
    const txId = scriptTag.getAttribute('data-transaction-id');
    if (txId) {
      Tracker.init({ transactionId: txId });
    }
  }

  // 수동 초기화를 위해 전역 노출
  window.IntendexTrackerApp = Tracker;

})(window, document);
