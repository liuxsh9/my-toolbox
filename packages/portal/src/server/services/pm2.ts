import pm2Lib from 'pm2'

interface Pm2ProcessInfo {
  status: string
  cpu: number
  memory: number
  uptime: number
}

export function getPm2Status(processName: string): Promise<Pm2ProcessInfo | null> {
  return new Promise((resolve) => {
    pm2Lib.connect((err) => {
      if (err) {
        resolve(null)
        return
      }

      pm2Lib.describe(processName, (err, list) => {
        pm2Lib.disconnect()

        if (err || !list || list.length === 0) {
          resolve(null)
          return
        }

        const proc = list[0]
        resolve({
          status: proc.pm2_env?.status || 'unknown',
          cpu: proc.monit?.cpu || 0,
          memory: proc.monit?.memory || 0,
          uptime: proc.pm2_env?.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : 0,
        })
      })
    })
  })
}
