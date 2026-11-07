(() => {
    if (typeof window.adBreak === "function") {
        return;
    }

    let noticeTimer;

    window.adBreak = (options = {}) => {
        console.warn(
            `[Ads] ${options.type || "Ad"} skipped: no ad provider is available on this host.`
        );

        let notice = document.getElementById("ad-unavailable-notice");
        if (!notice && document.body) {
            notice = document.createElement("div");
            notice.id = "ad-unavailable-notice";
            notice.setAttribute("role", "status");
            Object.assign(notice.style, {
                position: "fixed",
                left: "50%",
                bottom: "20px",
                transform: "translateX(-50%)",
                zIndex: "2147483647",
                maxWidth: "calc(100% - 32px)",
                padding: "12px 16px",
                borderRadius: "8px",
                background: "rgba(0, 0, 0, 0.85)",
                color: "#fff",
                font: "14px/1.4 sans-serif",
                textAlign: "center",
                pointerEvents: "none"
            });
            document.body.appendChild(notice);
        }

        if (notice) {
            notice.textContent =
                "Los anuncios no están disponibles en este sitio. No se ha concedido la recompensa.";
            notice.hidden = false;
            clearTimeout(noticeTimer);
            noticeTimer = setTimeout(() => {
                notice.hidden = true;
            }, 5000);
        }
    };
})();
