<script setup>
import { ref, computed, watch } from 'vue'
import { exportTeamsCSV, downloadCSV } from '../utils/formatters.js'

const props = defineProps({
  result: { type: Object, required: true }
})

defineEmits(['back', 'restart'])

function comparePlayers(a, b) {
  const yearA = a.birthYear
  const yearB = b.birthYear
  if (yearA && yearB) {
    const yearCmp = String(yearA).localeCompare(String(yearB), undefined, { numeric: true })
    if (yearCmp !== 0) return yearCmp
  } else if (yearA) {
    return -1
  } else if (yearB) {
    return 1
  }
  return (b.skill ?? 0) - (a.skill ?? 0)
}

const teams = computed(() =>
  props.result.teams.map(team => ({
    ...team,
    players: [...team.players].sort(comparePlayers)
  }))
)
const showAge = computed(() => props.result.balanceAge)
const hasSiblings = computed(() => teams.value.some(t => t.players.some(p => p.siblingGroup)))
const hasBirthYear = computed(() => teams.value.some(t => t.players.some(p => p.birthYear)))

function birthYearSummary(team) {
  const counts = team.birthYearCounts
  if (!counts || Object.keys(counts).length === 0) return ''
  return Object.keys(counts).sort().map(key => `${key}: ${counts[key]}`).join(' · ')
}

const teamNames = ref([])

watch(teams, (t) => {
  teamNames.value = t.map(team => team.name)
}, { immediate: true })

const skillRange = computed(() => {
  const avgs = teams.value.map(t => t.avgSkill)
  return {
    min: Math.min(...avgs),
    max: Math.max(...avgs),
    spread: Math.round((Math.max(...avgs) - Math.min(...avgs)) * 100) / 100
  }
})

const ageRange = computed(() => {
  if (!showAge.value) return null
  const avgs = teams.value.map(t => t.avgAge)
  return {
    min: Math.min(...avgs),
    max: Math.max(...avgs),
    spread: Math.round((Math.max(...avgs) - Math.min(...avgs)) * 100) / 100
  }
})

function handleExport() {
  const teamsWithNames = teams.value.map((t, i) => ({
    ...t,
    name: teamNames.value[i] || t.name
  }))
  const csv = exportTeamsCSV(teamsWithNames)
  downloadCSV(csv)
}

const teamColors = [
  'border-blue-200 bg-blue-50',
  'border-green-200 bg-green-50',
  'border-purple-200 bg-purple-50',
  'border-orange-200 bg-orange-50',
  'border-pink-200 bg-pink-50',
  'border-teal-200 bg-teal-50',
  'border-indigo-200 bg-indigo-50',
  'border-yellow-200 bg-yellow-50',
  'border-red-200 bg-red-50',
  'border-cyan-200 bg-cyan-50'
]
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <!-- Summary bar -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h3 class="text-lg font-semibold text-gray-800">Team Assignments</h3>
        <p class="text-sm text-gray-500">
          Skill spread: {{ skillRange.spread }}
          ({{ skillRange.min }} &ndash; {{ skillRange.max }} avg)
          <template v-if="ageRange">
            &nbsp;&middot;&nbsp; Age spread: {{ ageRange.spread }}
            ({{ ageRange.min }} &ndash; {{ ageRange.max }} avg)
          </template>
        </p>
      </div>
      <div class="flex gap-3">
        <button
          class="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          @click="$emit('back')"
        >
          Reconfigure
        </button>
        <button
          class="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          @click="$emit('restart')"
        >
          New File
        </button>
        <button
          class="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          @click="handleExport"
        >
          Export CSV
        </button>
      </div>
    </div>

    <!-- Team cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <div
        v-for="(team, idx) in teams"
        :key="idx"
        class="border rounded-xl overflow-hidden"
        :class="teamColors[idx % teamColors.length]"
      >
        <!-- Team header -->
        <div class="px-4 py-3 border-b border-inherit">
          <div class="flex items-center justify-between gap-2">
            <input
              v-model="teamNames[idx]"
              class="font-semibold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-400 focus:border-blue-500 focus:outline-none px-0 py-0.5 w-full"
            />
            <span class="text-xs text-gray-500 whitespace-nowrap">{{ team.count }} players</span>
          </div>
          <div class="flex gap-4 mt-1 text-xs text-gray-600">
            <span>Avg Skill: <strong>{{ team.avgSkill }}</strong></span>
            <span>Total Skill: {{ team.totalSkill }}</span>
            <span v-if="showAge">Avg Age: <strong>{{ team.avgAge }}</strong></span>
          </div>
          <p v-if="hasBirthYear && birthYearSummary(team)" class="mt-1 text-xs text-gray-600">
            Birth years: {{ birthYearSummary(team) }}
          </p>
        </div>

        <!-- Player table -->
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs font-medium text-gray-500 border-b border-inherit/50">
              <th class="text-left px-4 py-1.5 font-medium">Name</th>
              <th class="text-right px-4 py-1.5 font-medium">Skill</th>
              <th v-if="showAge" class="text-right px-4 py-1.5 font-medium">Age</th>
              <th v-if="hasBirthYear" class="text-right px-4 py-1.5 font-medium">Birth Year</th>
              <th v-if="hasSiblings" class="text-right px-4 py-1.5 font-medium">Siblings</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(player, pi) in team.players"
              :key="pi"
              class="border-t border-gray-100/60"
            >
              <td class="px-4 py-2 text-gray-800">{{ player.name }}</td>
              <td class="px-4 py-2 text-right text-gray-600 tabular-nums">{{ player.skill }}</td>
              <td v-if="showAge" class="px-4 py-2 text-right text-gray-600 tabular-nums">{{ player.age }}</td>
              <td v-if="hasBirthYear" class="px-4 py-2 text-right text-gray-600">{{ player.birthYear ?? '' }}</td>
              <td v-if="hasSiblings" class="px-4 py-2 text-right">
                <span
                  v-if="player.siblingGroup"
                  class="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded"
                >
                  {{ player.siblingGroup }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
