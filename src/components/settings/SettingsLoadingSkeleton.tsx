export default function SettingsLoadingSkeleton() {
  return (
    <main
      className="settings-loading-v2-page"
      aria-busy="true"
      aria-label="Carregando configurações"
    >
      <header className="settings-loading-v2-topbar">
        <div className="settings-loading-v2-topbar-inner">
          <span
            className="dashboard-skeleton settings-loading-v2-brand"
            aria-hidden="true"
          />

          <div className="settings-loading-v2-actions">
            <span
              className="dashboard-skeleton settings-loading-v2-back"
              aria-hidden="true"
            />

            <span
              className="dashboard-skeleton settings-loading-v2-circle"
              aria-hidden="true"
            />

            <span
              className="dashboard-skeleton settings-loading-v2-circle"
              aria-hidden="true"
            />

            <span
              className="dashboard-skeleton settings-loading-v2-account"
              aria-hidden="true"
            />
          </div>
        </div>
      </header>

      <div className="settings-loading-v2-container">
        <section className="settings-loading-v2-hero">
          <span className="settings-loading-v2-kicker">MINHA CONTA</span>

          <span
            className="dashboard-skeleton settings-loading-v2-title"
            aria-hidden="true"
          />

          <span
            className="dashboard-skeleton settings-loading-v2-subtitle"
            aria-hidden="true"
          />
        </section>

        <div className="settings-loading-v2-grid">
          <aside className="settings-loading-v2-sidebar">
            <div className="settings-loading-v2-nav">
              <span className="settings-loading-v2-nav-row is-active">
                <span className="dashboard-skeleton settings-loading-v2-nav-icon" />
                <span className="dashboard-skeleton settings-loading-v2-nav-text" />
                <span className="dashboard-skeleton settings-loading-v2-nav-chevron" />
              </span>

              <span className="settings-loading-v2-nav-row">
                <span className="dashboard-skeleton settings-loading-v2-nav-icon" />
                <span className="dashboard-skeleton settings-loading-v2-nav-text settings-loading-v2-nav-text-short" />
                <span className="dashboard-skeleton settings-loading-v2-nav-chevron" />
              </span>

              <span className="settings-loading-v2-nav-row">
                <span className="dashboard-skeleton settings-loading-v2-nav-icon" />
                <span className="dashboard-skeleton settings-loading-v2-nav-text settings-loading-v2-nav-text-small" />
                <span className="dashboard-skeleton settings-loading-v2-nav-chevron" />
              </span>

              <div className="settings-loading-v2-nav-divider" />

              <span className="dashboard-skeleton settings-loading-v2-legal" />

              <span className="settings-loading-v2-nav-row settings-loading-v2-privacy">
                <span className="dashboard-skeleton settings-loading-v2-nav-icon" />
                <span className="dashboard-skeleton settings-loading-v2-nav-text settings-loading-v2-nav-text-privacy" />
                <span className="dashboard-skeleton settings-loading-v2-nav-chevron" />
              </span>
            </div>
          </aside>

          <section className="settings-loading-v2-content">
            <article className="settings-loading-v2-card">
              <div className="settings-loading-v2-card-heading">
                <span
                  className="dashboard-skeleton settings-loading-v2-card-icon"
                  aria-hidden="true"
                />

                <div className="settings-loading-v2-card-heading-copy">
                  <span className="dashboard-skeleton settings-loading-v2-card-kicker" />
                  <span className="dashboard-skeleton settings-loading-v2-card-title" />
                </div>
              </div>

              <div className="settings-loading-v2-divider" />

              <div className="settings-loading-v2-profile">
                <span
                  className="dashboard-skeleton settings-loading-v2-avatar"
                  aria-hidden="true"
                />

                <div className="settings-loading-v2-profile-copy">
                  <span className="dashboard-skeleton settings-loading-v2-profile-title" />
                  <span className="dashboard-skeleton settings-loading-v2-profile-description" />

                  <div className="settings-loading-v2-profile-actions">
                    <span className="dashboard-skeleton settings-loading-v2-button" />
                    <span className="dashboard-skeleton settings-loading-v2-button settings-loading-v2-button-secondary" />
                  </div>
                </div>
              </div>

              <div className="settings-loading-v2-divider" />

              <div className="settings-loading-v2-form">
                <div className="settings-loading-v2-field">
                  <span className="dashboard-skeleton settings-loading-v2-label" />
                  <span className="dashboard-skeleton settings-loading-v2-input" />
                </div>

                <div className="settings-loading-v2-field">
                  <span className="dashboard-skeleton settings-loading-v2-label settings-loading-v2-label-email" />
                  <span className="dashboard-skeleton settings-loading-v2-input" />
                  <span className="dashboard-skeleton settings-loading-v2-helper" />
                </div>

                <span className="dashboard-skeleton settings-loading-v2-save" />
              </div>
            </article>

            <article className="settings-loading-v2-card settings-loading-v2-secondary-card">
              <div className="settings-loading-v2-card-heading">
                <span className="dashboard-skeleton settings-loading-v2-card-icon" />

                <div className="settings-loading-v2-card-heading-copy">
                  <span className="dashboard-skeleton settings-loading-v2-card-kicker" />
                  <span className="dashboard-skeleton settings-loading-v2-secondary-title" />
                </div>
              </div>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}
