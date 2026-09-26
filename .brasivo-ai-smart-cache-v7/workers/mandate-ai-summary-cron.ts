export interface Env {
  BRASIVO_BASE_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
  ): Promise<void> {
    const base =
      env.BRASIVO_BASE_URL.replace(
        /\/+$/,
        "",
      );

    const response =
      await fetch(
        `${base}/api/internal/mandate-summary-refresh`,
        {
          method: "POST",
          headers: {
            authorization:
              `Bearer ${env.CRON_SECRET}`,
          },
        },
      );

    if (!response.ok) {
      console.error(
        "[BRASIVO AI cache cron]",
        response.status,
        await response.text(),
      );

      return;
    }

    console.log(
      "[BRASIVO AI cache cron]",
      await response.text(),
    );
  },
};
