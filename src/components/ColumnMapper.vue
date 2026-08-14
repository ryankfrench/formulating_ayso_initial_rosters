<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  fileName: { type: String, default: '' }
})

const emit = defineEmits(['mapped', 'back'])

const nameCol = ref('')
const skillCol = ref('')
const siblingCol = ref('')
const ageCol = ref('')
const headCoachCol = ref('')

watch(() => props.columns, (cols) => {
  nameCol.value = ''
  skillCol.value = ''
  siblingCol.value = ''
  ageCol.value = ''
  headCoachCol.value = ''

  const lower = cols.map(c => ({ original: c, lower: c.toLowerCase() }))
  const nameGuess = lower.find(c => c.lower.includes('name') || c.lower.includes('player'))
  const skillGuess = lower.find(c =>
    c.lower.includes('skill') || c.lower.includes('rating') || c.lower.includes('rank') || c.lower.includes('valuation')
  )
  const sibGuess = lower.find(c => c.lower.includes('sibling') || c.lower.includes('family'))
  const ageGuess = lower.find(c => c.lower.includes('age') || c.lower.includes('birth'))
  const hcGuess = lower.find(c => c.lower.includes('coach') || c.lower.includes('hc'))

  if (nameGuess) nameCol.value = nameGuess.original
  if (skillGuess) skillCol.value = skillGuess.original
  if (sibGuess) siblingCol.value = sibGuess.original
  if (ageGuess) ageCol.value = ageGuess.original
  if (hcGuess) headCoachCol.value = hcGuess.original
}, { immediate: true })

const previewRows = computed(() => props.rows.slice(0, 8))

const validationError = computed(() => {
  if (!nameCol.value) return 'Please select a Player Name column.'
  if (!skillCol.value) return 'Please select a Skill Rating column.'
  const nonNumeric = props.rows.find(r => {
    const v = r[skillCol.value]
    return v !== null && v !== undefined && v !== '' && isNaN(Number(v))
  })
  if (nonNumeric) return `Skill column contains non-numeric values (e.g. "${nonNumeric[skillCol.value]}").`
  if (ageCol.value) {
    const badAge = props.rows.find(r => {
      const v = r[ageCol.value]
      return v !== null && v !== undefined && v !== '' && isNaN(Number(v))
    })
    if (badAge) return `Age column contains non-numeric values (e.g. "${badAge[ageCol.value]}").`
  }
  return ''
})

function submit() {
  if (validationError.value) return
  emit('mapped', {
    nameCol: nameCol.value,
    skillCol: skillCol.value,
    siblingCol: siblingCol.value || null,
    ageCol: ageCol.value || null,
    headCoachCol: headCoachCol.value || null
  })
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h3 class="text-lg font-semibold text-gray-800">Map Your Columns</h3>
        <p class="text-sm text-gray-500">{{ fileName }} &mdash; {{ rows.length }} players found</p>
      </div>
      <button
        class="text-sm text-gray-500 hover:text-gray-700 underline"
        @click="$emit('back')"
      >
        Choose different file
      </button>
    </div>

    <!-- Column mapping selectors -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Player Name <span class="text-red-500">*</span>
        </label>
        <select v-model="nameCol" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm bg-white">
          <option value="">Select column...</option>
          <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Skill Rating <span class="text-red-500">*</span>
        </label>
        <select v-model="skillCol" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm bg-white">
          <option value="">Select column...</option>
          <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Sibling Group <span class="text-gray-400">(optional)</span>
        </label>
        <select v-model="siblingCol" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm bg-white">
          <option value="">None</option>
          <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Age <span class="text-gray-400">(optional)</span>
        </label>
        <select v-model="ageCol" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm bg-white">
          <option value="">None</option>
          <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Head Coach <span class="text-gray-400">(optional)</span>
        </label>
        <select v-model="headCoachCol" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm bg-white">
          <option value="">None</option>
          <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
        </select>
        <p class="text-xs text-gray-500 mt-1">Rows with "HC" will be placed on separate teams</p>
      </div>
    </div>

    <!-- Data preview -->
    <div class="overflow-x-auto rounded-lg border border-gray-200 mb-6">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th v-for="col in columns" :key="col" class="px-4 py-2 text-left font-medium text-gray-600">
              {{ col }}
              <span v-if="col === nameCol" class="ml-1 text-xs text-blue-600">(Name)</span>
              <span v-else-if="col === skillCol" class="ml-1 text-xs text-green-600">(Skill)</span>
              <span v-else-if="col === siblingCol" class="ml-1 text-xs text-purple-600">(Sibling)</span>
              <span v-else-if="col === ageCol" class="ml-1 text-xs text-orange-600">(Age)</span>
              <span v-else-if="col === headCoachCol" class="ml-1 text-xs text-teal-600">(HC)</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in previewRows" :key="idx" class="border-t border-gray-100">
            <td v-for="col in columns" :key="col" class="px-4 py-2 text-gray-700">
              {{ row[col] }}
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="rows.length > 8" class="text-xs text-gray-400 px-4 py-2 bg-gray-50">
        Showing 8 of {{ rows.length }} rows
      </p>
    </div>

    <!-- Validation + submit -->
    <div class="flex items-center justify-between">
      <p v-if="validationError" class="text-sm text-red-600">{{ validationError }}</p>
      <div v-else></div>
      <button
        :disabled="!!validationError"
        class="px-6 py-2 rounded-lg text-white font-medium transition-colors"
        :class="validationError
          ? 'bg-gray-300 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700'"
        @click="submit"
      >
        Next: Configure
      </button>
    </div>
  </div>
</template>
