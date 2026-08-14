<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  playerCount: { type: Number, required: true },
  hasAge: { type: Boolean, default: false },
  hasSiblings: { type: Boolean, default: false },
  headCoachCount: { type: Number, default: 0 }
})

const emit = defineEmits(['solve', 'back'])

const numTeams = ref(4)
const balanceAge = ref(true)
const timeLimit = ref(30)
const timeLimitOptions = [
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' }
]

const playersPerTeam = computed(() => {
  if (numTeams.value < 1) return ''
  const min = Math.floor(props.playerCount / numTeams.value)
  const max = Math.ceil(props.playerCount / numTeams.value)
  return min === max ? `${min} players each` : `${min}–${max} players each`
})

const teamsError = computed(() => {
  if (!numTeams.value || numTeams.value < 2) return 'Need at least 2 teams.'
  if (numTeams.value > props.playerCount) return 'More teams than players.'
  return ''
})

function submit() {
  if (teamsError.value) return
  emit('solve', {
    numTeams: numTeams.value,
    balanceAge: props.hasAge && balanceAge.value,
    timeLimit: timeLimit.value
  })
}
</script>

<template>
  <div class="max-w-md mx-auto">
    <h3 class="text-lg font-semibold text-gray-800 mb-6">Configure Assignment</h3>

    <div class="space-y-5">
      <!-- Number of teams -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Number of Teams</label>
        <input
          v-model.number="numTeams"
          type="number"
          min="2"
          :max="playerCount"
          class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm"
        />
        <p v-if="teamsError" class="text-sm text-red-600 mt-1">{{ teamsError }}</p>
        <p v-else class="text-sm text-gray-500 mt-1">
          {{ playerCount }} players &rarr; {{ playersPerTeam }}
        </p>
      </div>

      <!-- Balance team sizes (always on) -->
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <input type="checkbox" checked disabled class="h-4 w-4 rounded" />
        <div>
          <p class="text-sm font-medium text-gray-700">Balance team sizes</p>
          <p class="text-xs text-gray-500">Teams will differ by at most 1 player</p>
        </div>
      </div>

      <!-- Balance skill (always on) -->
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <input type="checkbox" checked disabled class="h-4 w-4 rounded" />
        <div>
          <p class="text-sm font-medium text-gray-700">Balance skill ratings</p>
          <p class="text-xs text-gray-500">Minimizes the spread of total skill across teams</p>
        </div>
      </div>

      <!-- Sibling constraint info -->
      <div v-if="hasSiblings" class="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
        <input type="checkbox" checked disabled class="h-4 w-4 rounded accent-purple-600" />
        <div>
          <p class="text-sm font-medium text-gray-700">Keep siblings together</p>
          <p class="text-xs text-gray-500">Players in the same sibling group will be on the same team</p>
        </div>
      </div>

      <!-- Head coach constraint info -->
      <div v-if="headCoachCount > 0" class="flex items-center gap-3 p-3 bg-teal-50 rounded-lg">
        <input type="checkbox" checked disabled class="h-4 w-4 rounded accent-teal-600" />
        <div>
          <p class="text-sm font-medium text-gray-700">Separate head coaches</p>
          <p class="text-xs text-gray-500">{{ headCoachCount }} head coach{{ headCoachCount > 1 ? 'es' : '' }} will each be placed on a different team</p>
        </div>
      </div>

      <!-- Balance age toggle -->
      <div v-if="hasAge" class="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
        <input v-model="balanceAge" type="checkbox" class="h-4 w-4 rounded accent-orange-600" />
        <div>
          <p class="text-sm font-medium text-gray-700">Balance average age</p>
          <p class="text-xs text-gray-500">Also minimizes the spread of total age across teams</p>
        </div>
      </div>

      <!-- Solver time limit -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Solver Time Limit</label>
        <select
          v-model.number="timeLimit"
          class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm"
        >
          <option v-for="opt in timeLimitOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <p class="text-sm text-gray-500 mt-1">Longer limits may improve balance for large rosters</p>
      </div>
    </div>

    <div class="flex items-center justify-between mt-8">
      <button
        class="text-sm text-gray-500 hover:text-gray-700 underline"
        @click="$emit('back')"
      >
        Back
      </button>
      <button
        :disabled="!!teamsError"
        class="px-6 py-2 rounded-lg text-white font-medium transition-colors"
        :class="teamsError
          ? 'bg-gray-300 cursor-not-allowed'
          : 'bg-green-600 hover:bg-green-700'"
        @click="submit"
      >
        Solve
      </button>
    </div>
  </div>
</template>
