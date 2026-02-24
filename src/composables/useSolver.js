import { ref } from 'vue'
import GLPK from 'glpk.js'

let glpkInstance = null
async function getGLPK() {
  if (!glpkInstance) {
    glpkInstance = await GLPK()
  }
  return glpkInstance
}

export function useSolver() {
  const solving = ref(false)
  const solverError = ref('')
  const result = ref(null)

  async function solve({ players, numTeams, balanceAge }) {
    solving.value = true
    solverError.value = ''
    result.value = null

    try {
      const glpk = await getGLPK()
      const n = players.length
      const k = numTeams

      if (n < k) {
        throw new Error(`Need at least ${k} players for ${k} teams, but only have ${n}.`)
      }

      const F = Math.floor(n / k)
      const C = Math.ceil(n / k)
      const R = n % k
      const unevenTeams = R > 0

      // Build sibling groups: map group key -> list of player indices
      const siblingGroups = {}
      players.forEach((p, i) => {
        if (p.siblingGroup !== null && p.siblingGroup !== undefined && String(p.siblingGroup).trim() !== '') {
          const key = String(p.siblingGroup).trim()
          if (!siblingGroups[key]) siblingGroups[key] = []
          siblingGroups[key].push(i)
        }
      })
      const siblingGroupList = Object.values(siblingGroups).filter(g => g.length >= 2)

      for (const group of siblingGroupList) {
        if (group.length > C) {
          throw new Error(
            `Sibling group of size ${group.length} exceeds max team size of ${C}. ` +
            `Reduce team count or remove some siblings from the same group.`
          )
        }
      }

      const varName = (i, j) => `x_${i}_${j}`

      const binaries = []
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < k; j++) {
          binaries.push(varName(i, j))
        }
      }

      if (unevenTeams) {
        for (let j = 0; j < k; j++) {
          binaries.push(`y_${j}`)
        }
      }

      const objectiveVars = [
        { name: 'S_max', coef: 1.0 },
        { name: 'S_min', coef: -1.0 }
      ]
      if (balanceAge) {
        objectiveVars.push({ name: 'A_max', coef: 0.5 })
        objectiveVars.push({ name: 'A_min', coef: -0.5 })
      }

      const subjectTo = []

      // Each player assigned to exactly one team
      for (let i = 0; i < n; i++) {
        const vars = []
        for (let j = 0; j < k; j++) {
          vars.push({ name: varName(i, j), coef: 1.0 })
        }
        subjectTo.push({
          name: `assign_${i}`,
          vars,
          bnds: { type: glpk.GLP_FX, ub: 1.0, lb: 1.0 }
        })
      }

      // Team size constraints
      if (unevenTeams) {
        // sum_i(x_ij) - y_j = F  (y_j=1 means team j has C=F+1 players)
        for (let j = 0; j < k; j++) {
          const vars = []
          for (let i = 0; i < n; i++) {
            vars.push({ name: varName(i, j), coef: 1.0 })
          }
          vars.push({ name: `y_${j}`, coef: -1.0 })
          subjectTo.push({
            name: `size_${j}`,
            vars,
            bnds: { type: glpk.GLP_FX, lb: F, ub: F }
          })
        }
        // Exactly R teams are large
        const yVars = []
        for (let j = 0; j < k; j++) {
          yVars.push({ name: `y_${j}`, coef: 1.0 })
        }
        subjectTo.push({
          name: 'num_large',
          vars: yVars,
          bnds: { type: glpk.GLP_FX, lb: R, ub: R }
        })
      } else {
        for (let j = 0; j < k; j++) {
          const vars = []
          for (let i = 0; i < n; i++) {
            vars.push({ name: varName(i, j), coef: 1.0 })
          }
          subjectTo.push({
            name: `size_${j}`,
            vars,
            bnds: { type: glpk.GLP_FX, lb: F, ub: F }
          })
        }
      }

      // --- Skill average constraints ---
      // We minimize S_max - S_min where S_max/S_min bound team averages.
      // avg_j = T_j / n_j. Since n_j is either F or C, we use big-M
      // linearization so the correct divisor activates per team.
      const totalSkill = players.reduce((s, p) => s + p.skill, 0)
      const M_skill = totalSkill

      for (let j = 0; j < k; j++) {
        const skillVars = players.map((p, i) => ({ name: varName(i, j), coef: -p.skill }))

        if (unevenTeams) {
          // S_max >= T_j/F when y_j=0:  F*S_max - T_j + M*y_j >= 0
          subjectTo.push({
            name: `savgmax_f_${j}`,
            vars: [{ name: 'S_max', coef: F }, ...skillVars, { name: `y_${j}`, coef: M_skill }],
            bnds: { type: glpk.GLP_LO, lb: 0.0, ub: 0.0 }
          })
          // S_max >= T_j/C when y_j=1:  C*S_max - T_j - M*y_j >= -M
          subjectTo.push({
            name: `savgmax_c_${j}`,
            vars: [{ name: 'S_max', coef: C }, ...skillVars, { name: `y_${j}`, coef: -M_skill }],
            bnds: { type: glpk.GLP_LO, lb: -M_skill, ub: 0.0 }
          })
          // S_min <= T_j/F when y_j=0:  F*S_min - T_j - M*y_j <= 0
          subjectTo.push({
            name: `savgmin_f_${j}`,
            vars: [{ name: 'S_min', coef: F }, ...skillVars, { name: `y_${j}`, coef: -M_skill }],
            bnds: { type: glpk.GLP_UP, lb: 0.0, ub: 0.0 }
          })
          // S_min <= T_j/C when y_j=1:  C*S_min - T_j + M*y_j <= M
          subjectTo.push({
            name: `savgmin_c_${j}`,
            vars: [{ name: 'S_min', coef: C }, ...skillVars, { name: `y_${j}`, coef: M_skill }],
            bnds: { type: glpk.GLP_UP, lb: 0.0, ub: M_skill }
          })
        } else {
          // All teams size F: F*S_max - T_j >= 0, F*S_min - T_j <= 0
          subjectTo.push({
            name: `savgmax_${j}`,
            vars: [{ name: 'S_max', coef: F }, ...skillVars],
            bnds: { type: glpk.GLP_LO, lb: 0.0, ub: 0.0 }
          })
          subjectTo.push({
            name: `savgmin_${j}`,
            vars: [{ name: 'S_min', coef: F }, ...skillVars],
            bnds: { type: glpk.GLP_UP, lb: 0.0, ub: 0.0 }
          })
        }
      }

      // --- Age average constraints (optional, same structure as skill) ---
      if (balanceAge) {
        const totalAge = players.reduce((s, p) => s + (p.age || 0), 0)
        const M_age = totalAge

        for (let j = 0; j < k; j++) {
          const ageVars = players.map((p, i) => ({ name: varName(i, j), coef: -(p.age || 0) }))

          if (unevenTeams) {
            subjectTo.push({
              name: `aavgmax_f_${j}`,
              vars: [{ name: 'A_max', coef: F }, ...ageVars, { name: `y_${j}`, coef: M_age }],
              bnds: { type: glpk.GLP_LO, lb: 0.0, ub: 0.0 }
            })
            subjectTo.push({
              name: `aavgmax_c_${j}`,
              vars: [{ name: 'A_max', coef: C }, ...ageVars, { name: `y_${j}`, coef: -M_age }],
              bnds: { type: glpk.GLP_LO, lb: -M_age, ub: 0.0 }
            })
            subjectTo.push({
              name: `aavgmin_f_${j}`,
              vars: [{ name: 'A_min', coef: F }, ...ageVars, { name: `y_${j}`, coef: -M_age }],
              bnds: { type: glpk.GLP_UP, lb: 0.0, ub: 0.0 }
            })
            subjectTo.push({
              name: `aavgmin_c_${j}`,
              vars: [{ name: 'A_min', coef: C }, ...ageVars, { name: `y_${j}`, coef: M_age }],
              bnds: { type: glpk.GLP_UP, lb: 0.0, ub: M_age }
            })
          } else {
            subjectTo.push({
              name: `aavgmax_${j}`,
              vars: [{ name: 'A_max', coef: F }, ...ageVars],
              bnds: { type: glpk.GLP_LO, lb: 0.0, ub: 0.0 }
            })
            subjectTo.push({
              name: `aavgmin_${j}`,
              vars: [{ name: 'A_min', coef: F }, ...ageVars],
              bnds: { type: glpk.GLP_UP, lb: 0.0, ub: 0.0 }
            })
          }
        }
      }

      // Sibling constraints: all siblings in a group go to the same team
      siblingGroupList.forEach((group, gi) => {
        const refPlayer = group[0]
        for (let mi = 1; mi < group.length; mi++) {
          const other = group[mi]
          for (let j = 0; j < k; j++) {
            subjectTo.push({
              name: `sib_${gi}_${mi}_${j}`,
              vars: [
                { name: varName(refPlayer, j), coef: 1.0 },
                { name: varName(other, j), coef: -1.0 }
              ],
              bnds: { type: glpk.GLP_FX, ub: 0.0, lb: 0.0 }
            })
          }
        }
      })

      const lp = {
        name: 'TeamAssignment',
        objective: {
          direction: glpk.GLP_MIN,
          name: 'obj',
          vars: objectiveVars
        },
        subjectTo,
        binaries
      }

      const options = {
        msglev: glpk.GLP_MSG_OFF,
        tmlim: 30
      }

      const sol = await glpk.solve(lp, options)

      if (sol.result.status !== glpk.GLP_OPT && sol.result.status !== glpk.GLP_FEAS) {
        throw new Error(
          'Could not find a feasible assignment. Try reducing constraints ' +
          '(e.g., fewer teams or removing sibling requirements).'
        )
      }

      // Extract assignments
      const teams = Array.from({ length: k }, () => [])
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < k; j++) {
          if (Math.round(sol.result.vars[varName(i, j)]) === 1) {
            teams[j].push(players[i])
            break
          }
        }
      }

      // Compute stats
      const teamStats = teams.map((team, j) => {
        const tSkill = team.reduce((s, p) => s + p.skill, 0)
        const avgSkill = team.length > 0 ? tSkill / team.length : 0
        const stats = {
          index: j,
          name: `Team ${j + 1}`,
          players: team,
          count: team.length,
          totalSkill: tSkill,
          avgSkill: Math.round(avgSkill * 100) / 100
        }
        if (balanceAge) {
          const tAge = team.reduce((s, p) => s + (p.age || 0), 0)
          stats.totalAge = tAge
          stats.avgAge = team.length > 0 ? Math.round((tAge / team.length) * 100) / 100 : 0
        }
        return stats
      })

      result.value = {
        teams: teamStats,
        objectiveValue: sol.result.z,
        balanceAge
      }
    } catch (err) {
      solverError.value = err.message || 'Solver failed.'
    } finally {
      solving.value = false
    }
  }

  function reset() {
    result.value = null
    solverError.value = ''
  }

  return { solving, solverError, result, solve, reset }
}
