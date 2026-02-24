export function exportTeamsCSV(teamStats) {
  const headers = ['Team', 'Player Name', 'Skill Rating']
  const hasAge = teamStats.some(t => t.avgAge !== undefined)
  if (hasAge) headers.push('Age')
  if (teamStats[0]?.players[0]?.siblingGroup) headers.push('Sibling Group')

  const lines = [headers.join(',')]

  for (const team of teamStats) {
    for (const player of team.players) {
      const row = [team.name, `"${player.name}"`, player.skill]
      if (hasAge) row.push(player.age ?? '')
      if (teamStats[0]?.players[0]?.siblingGroup) row.push(player.siblingGroup ?? '')
      lines.push(row.join(','))
    }
  }

  return lines.join('\n')
}

export function downloadCSV(csvString, filename = 'team_assignments.csv') {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
