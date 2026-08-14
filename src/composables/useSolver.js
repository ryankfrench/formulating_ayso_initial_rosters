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

  async function solve({ players, numTeams, balanceAge, timeLimit = 30 }) {
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

      // Build birth year groups: map group key -> list of player indices
      const birthYearGroups = {}
      players.forEach((p, i) => {
        if (p.birthYear !== null && p.birthYear !== undefined && String(p.birthYear).trim() !== '') {
          const key = String(p.birthYear).trim()
          if (!birthYearGroups[key]) birthYearGroups[key] = []
          birthYearGroups[key].push(i)
        }
      })
      const birthYearGroupList = Object.entries(birthYearGroups).map(([key, indices]) => ({ key, indices }))

      for (const { key, indices } of birthYearGroupList) {
        const C_g = Math.ceil(indices.length / k)
        const bySet = new Set(indices)
        for (const group of siblingGroupList) {
          const sameYear = group.filter(i => bySet.has(i))
          if (sameYear.length > C_g) {
            throw new Error(
              `Sibling group has ${sameYear.length} players born in ${key}, ` +
              `but each team can have at most ${C_g} from that birth year. ` +
              `Reduce team count or split the sibling group.`
            )
          }
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

      birthYearGroupList.forEach(({ indices }, gi) => {
        if (indices.length % k > 0) {
          for (let j = 0; j < k; j++) {
            binaries.push(`y_by_${gi}_${j}`)
          }
        }
      })

      const objectiveVars = []
      for (let j = 0; j < k; j++) {
        objectiveVars.push({ name: `D_skill_${j}`, coef: 1.0 })
      }
      if (balanceAge) {
        for (let j = 0; j < k; j++) {
          objectiveVars.push({ name: `D_age_${j}`, coef: 0.5 })
        }
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

      // Birth year count constraints (same ±1 pattern as team size, per group)
      birthYearGroupList.forEach(({ indices }, gi) => {
        const n_g = indices.length
        const F_g = Math.floor(n_g / k)
        const R_g = n_g % k
        if (R_g > 0) {
          for (let j = 0; j < k; j++) {
            const vars = indices.map(i => ({ name: varName(i, j), coef: 1.0 }))
            vars.push({ name: `y_by_${gi}_${j}`, coef: -1.0 })
            subjectTo.push({
              name: `size_by_${gi}_${j}`,
              vars,
              bnds: { type: glpk.GLP_FX, lb: F_g, ub: F_g }
            })
          }
          const yVars = []
          for (let j = 0; j < k; j++) {
            yVars.push({ name: `y_by_${gi}_${j}`, coef: 1.0 })
          }
          subjectTo.push({
            name: `num_large_by_${gi}`,
            vars: yVars,
            bnds: { type: glpk.GLP_FX, lb: R_g, ub: R_g }
          })
        } else {
          for (let j = 0; j < k; j++) {
            const vars = indices.map(i => ({ name: varName(i, j), coef: 1.0 }))
            subjectTo.push({
              name: `size_by_${gi}_${j}`,
              vars,
              bnds: { type: glpk.GLP_FX, lb: F_g, ub: F_g }
            })
          }
        }
      })

      // --- Skill deviation constraints ---
      // Minimize sum of |T_j - target_j| where target_j = mu * (F + y_j).
      // mu (global avg skill) is a known constant, so target_j is linear.
      const totalSkill = players.reduce((s, p) => s + p.skill, 0)
      const muSkill = totalSkill / n

      const bounds = []
      for (let j = 0; j < k; j++) {
        bounds.push({ name: `D_skill_${j}`, type: glpk.GLP_LO, lb: 0.0, ub: 0.0 })
      }

      for (let j = 0; j < k; j++) {
        const skillVarsPos = players.map((p, i) => ({ name: varName(i, j), coef: p.skill }))
        const skillVarsNeg = players.map((p, i) => ({ name: varName(i, j), coef: -p.skill }))

        if (unevenTeams) {
          // T_j - mu*F - mu*y_j <= D_j
          subjectTo.push({
            name: `sdev_pos_${j}`,
            vars: [...skillVarsPos, { name: `y_${j}`, coef: -muSkill }, { name: `D_skill_${j}`, coef: -1.0 }],
            bnds: { type: glpk.GLP_UP, lb: 0.0, ub: muSkill * F }
          })
          // mu*F + mu*y_j - T_j <= D_j
          subjectTo.push({
            name: `sdev_neg_${j}`,
            vars: [...skillVarsNeg, { name: `y_${j}`, coef: muSkill }, { name: `D_skill_${j}`, coef: -1.0 }],
            bnds: { type: glpk.GLP_UP, lb: 0.0, ub: -(muSkill * F) }
          })
        } else {
          // T_j - F*mu <= D_j
          subjectTo.push({
            name: `sdev_pos_${j}`,
            vars: [...skillVarsPos, { name: `D_skill_${j}`, coef: -1.0 }],
            bnds: { type: glpk.GLP_UP, lb: 0.0, ub: muSkill * F }
          })
          // F*mu - T_j <= D_j
          subjectTo.push({
            name: `sdev_neg_${j}`,
            vars: [...skillVarsNeg, { name: `D_skill_${j}`, coef: -1.0 }],
            bnds: { type: glpk.GLP_UP, lb: 0.0, ub: -(muSkill * F) }
          })
        }
      }

      // --- Age deviation constraints (optional, same structure as skill) ---
      if (balanceAge) {
        const totalAge = players.reduce((s, p) => s + (p.age || 0), 0)
        const muAge = totalAge / n

        for (let j = 0; j < k; j++) {
          bounds.push({ name: `D_age_${j}`, type: glpk.GLP_LO, lb: 0.0, ub: 0.0 })
        }

        for (let j = 0; j < k; j++) {
          const ageVarsPos = players.map((p, i) => ({ name: varName(i, j), coef: (p.age || 0) }))
          const ageVarsNeg = players.map((p, i) => ({ name: varName(i, j), coef: -(p.age || 0) }))

          if (unevenTeams) {
            subjectTo.push({
              name: `adev_pos_${j}`,
              vars: [...ageVarsPos, { name: `y_${j}`, coef: -muAge }, { name: `D_age_${j}`, coef: -1.0 }],
              bnds: { type: glpk.GLP_UP, lb: 0.0, ub: muAge * F }
            })
            subjectTo.push({
              name: `adev_neg_${j}`,
              vars: [...ageVarsNeg, { name: `y_${j}`, coef: muAge }, { name: `D_age_${j}`, coef: -1.0 }],
              bnds: { type: glpk.GLP_UP, lb: 0.0, ub: -(muAge * F) }
            })
          } else {
            subjectTo.push({
              name: `adev_pos_${j}`,
              vars: [...ageVarsPos, { name: `D_age_${j}`, coef: -1.0 }],
              bnds: { type: glpk.GLP_UP, lb: 0.0, ub: muAge * F }
            })
            subjectTo.push({
              name: `adev_neg_${j}`,
              vars: [...ageVarsNeg, { name: `D_age_${j}`, coef: -1.0 }],
              bnds: { type: glpk.GLP_UP, lb: 0.0, ub: -(muAge * F) }
            })
          }
        }
      }

      // Head coach constraints: every pair of HC players must be on different teams
      const hcIndices = players.map((p, i) => p.headCoach ? i : -1).filter(i => i >= 0)
      const hcSet = new Set(hcIndices)
      if (hcIndices.length > k) {
        throw new Error(
          `There are ${hcIndices.length} head coaches but only ${k} teams. ` +
          `Increase team count or reduce head coach designations.`
        )
      }
      for (const group of siblingGroupList) {
        const hcInGroup = group.filter(i => hcSet.has(i))
        if (hcInGroup.length >= 2) {
          const names = hcInGroup.map(i => players[i].name).join(', ')
          throw new Error(
            `Sibling group contains multiple head coaches (${names}). ` +
            `Siblings must be on the same team, but head coaches must be on separate teams. ` +
            `Remove the HC designation from all but one sibling in this group.`
          )
        }
      }
      for (let a = 0; a < hcIndices.length; a++) {
        for (let b = a + 1; b < hcIndices.length; b++) {
          for (let j = 0; j < k; j++) {
            subjectTo.push({
              name: `hc_${hcIndices[a]}_${hcIndices[b]}_${j}`,
              vars: [
                { name: varName(hcIndices[a], j), coef: 1.0 },
                { name: varName(hcIndices[b], j), coef: 1.0 }
              ],
              bnds: { type: glpk.GLP_UP, lb: 0.0, ub: 1.0 }
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
        bounds,
        binaries
      }

      const options = {
        msglev: glpk.GLP_MSG_OFF,
        tmlim: timeLimit
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
        if (birthYearGroupList.length > 0) {
          const birthYearCounts = {}
          for (const p of team) {
            if (p.birthYear) {
              birthYearCounts[p.birthYear] = (birthYearCounts[p.birthYear] || 0) + 1
            }
          }
          stats.birthYearCounts = birthYearCounts
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
