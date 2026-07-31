// Positionierung von Zeitraster-Terminen: überlappende Termine bekommen
// gleich breite Nebeneinander-Spalten statt sich zu überdecken.
export interface ZeitrasterEintrag {
  id: string
  startMin: number // Minuten seit Mitternacht
  endMin: number
}

export interface PositioniertesEreignis<T extends ZeitrasterEintrag> {
  eintrag: T
  spalte: number
  spaltenAnzahl: number
}

export function positioniereEreignisse<T extends ZeitrasterEintrag>(eintraege: T[]): PositioniertesEreignis<T>[] {
  const sortiert = [...eintraege].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const ergebnis: PositioniertesEreignis<T>[] = []

  // Cluster überlappender Termine bilden (transitive Überlappung).
  let cluster: T[] = []
  let clusterEnde = -1

  function clusterAbschließen() {
    if (cluster.length === 0) return
    // Greedy Spaltenzuweisung: jede Spalte merkt sich ihr letztes Ende.
    const spaltenEnden: number[] = []
    const zuweisung = new Map<T, number>()
    for (const e of cluster) {
      let spalte = spaltenEnden.findIndex((ende) => ende <= e.startMin)
      if (spalte === -1) {
        spalte = spaltenEnden.length
        spaltenEnden.push(e.endMin)
      } else {
        spaltenEnden[spalte] = e.endMin
      }
      zuweisung.set(e, spalte)
    }
    const spaltenAnzahl = spaltenEnden.length
    for (const e of cluster) {
      ergebnis.push({ eintrag: e, spalte: zuweisung.get(e)!, spaltenAnzahl })
    }
    cluster = []
    clusterEnde = -1
  }

  for (const e of sortiert) {
    if (cluster.length > 0 && e.startMin >= clusterEnde) {
      clusterAbschließen()
    }
    cluster.push(e)
    clusterEnde = Math.max(clusterEnde, e.endMin)
  }
  clusterAbschließen()

  return ergebnis
}
