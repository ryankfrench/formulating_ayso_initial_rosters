<script setup>
import { ref, computed } from 'vue'
import { useFileParser } from './composables/useFileParser.js'
import { useSolver } from './composables/useSolver.js'
import FileUpload from './components/FileUpload.vue'
import ColumnMapper from './components/ColumnMapper.vue'
import ConfigureSolver from './components/ConfigureSolver.vue'
import Results from './components/Results.vue'

const step = ref(1)
const { rows, columns, fileName, error: parseError, parsing, parseFile, reset: resetParser } = useFileParser()
const { solving, solverError, result, solve, reset: resetSolver } = useSolver()

const mapping = ref(null)

const players = computed(() => {
  if (!mapping.value || rows.value.length === 0) return []
  return rows.value.map(row => ({
    name: row[mapping.value.nameCol] ?? '',
    skill: Number(row[mapping.value.skillCol]) || 0,
    siblingGroup: mapping.value.siblingCol ? row[mapping.value.siblingCol] : null,
    age: mapping.value.ageCol ? Number(row[mapping.value.ageCol]) || 0 : null,
    birthYear: mapping.value.birthYearCol
      ? (String(row[mapping.value.birthYearCol] ?? '').trim() || null)
      : null,
    headCoach: mapping.value.headCoachCol
      ? String(row[mapping.value.headCoachCol] ?? '').trim().toUpperCase() === 'HC'
      : false
  }))
})

async function handleFileSelected(file) {
  await parseFile(file)
  if (!parseError.value) {
    step.value = 2
  }
}

function handleMapped(m) {
  mapping.value = m
  step.value = 3
}

async function handleSolve(config) {
  await solve({
    players: players.value,
    numTeams: config.numTeams,
    balanceAge: config.balanceAge,
    timeLimit: config.timeLimit
  })
  if (!solverError.value) {
    step.value = 4
  }
}

function goBack(toStep) {
  if (toStep <= 2) resetSolver()
  step.value = toStep
}

function restart() {
  resetParser()
  resetSolver()
  mapping.value = null
  step.value = 1
}

const stepLabels = ['Upload', 'Map Columns', 'Configure', 'Results']
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200">
      <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-900">Formulating AYSO Initial Rosters</h1>
        <button
          v-if="step > 1"
          class="text-sm text-gray-500 hover:text-gray-700"
          @click="restart"
        >
          Start Over
        </button>
      </div>
    </header>

    <!-- Step indicator -->
    <div class="max-w-6xl mx-auto px-4 py-6">
      <div class="flex items-center justify-center gap-2 mb-8">
        <template v-for="(label, idx) in stepLabels" :key="idx">
          <div class="flex items-center gap-2">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
              :class="
                step > idx + 1 ? 'bg-green-100 text-green-700' :
                step === idx + 1 ? 'bg-blue-600 text-white' :
                'bg-gray-200 text-gray-500'
              "
            >
              <svg v-if="step > idx + 1" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span v-else>{{ idx + 1 }}</span>
            </div>
            <span
              class="text-sm hidden sm:inline"
              :class="step === idx + 1 ? 'font-medium text-gray-800' : 'text-gray-500'"
            >
              {{ label }}
            </span>
          </div>
          <div
            v-if="idx < stepLabels.length - 1"
            class="w-8 h-px"
            :class="step > idx + 1 ? 'bg-green-300' : 'bg-gray-300'"
          ></div>
        </template>
      </div>

      <!-- Error banners -->
      <div v-if="parseError" class="max-w-xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        {{ parseError }}
      </div>
      <div v-if="solverError" class="max-w-xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        {{ solverError }}
      </div>

      <!-- Loading states -->
      <div v-if="parsing || solving" class="text-center py-12">
        <div class="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p class="mt-3 text-sm text-gray-600">
          {{ parsing ? 'Parsing file...' : 'Solving assignment...' }}
        </p>
      </div>

      <!-- Steps -->
      <template v-else>
        <FileUpload v-if="step === 1" @file-selected="handleFileSelected" />
        <ColumnMapper
          v-else-if="step === 2"
          :columns="columns"
          :rows="rows"
          :file-name="fileName"
          @mapped="handleMapped"
          @back="restart"
        />
        <ConfigureSolver
          v-else-if="step === 3"
          :player-count="players.length"
          :has-age="!!mapping?.ageCol"
          :has-birth-year="!!mapping?.birthYearCol"
          :has-siblings="!!mapping?.siblingCol"
          :head-coach-count="players.filter(p => p.headCoach).length"
          @solve="handleSolve"
          @back="goBack(2)"
        />
        <Results
          v-else-if="step === 4"
          :result="result"
          @back="goBack(3)"
          @restart="restart"
        />
      </template>
    </div>

    <!-- Footer -->
    <footer class="border-t border-gray-200 mt-12 py-6 text-center text-sm text-gray-400">
      <p>Developed by Ryan French</p>
      <p class="mt-1">
        Contact
        <a href="mailto:frenchryank@gmail.com" class="text-blue-500 hover:text-blue-600">frenchryank@gmail.com</a>
        for help
      </p>
    </footer>
  </div>
</template>
