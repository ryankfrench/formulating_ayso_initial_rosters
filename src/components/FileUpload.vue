<script setup>
import { ref } from 'vue'

const emit = defineEmits(['file-selected'])

const dragOver = ref(false)
const fileInput = ref(null)

function handleDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer.files[0]
  if (file) emit('file-selected', file)
}

function handleFileInput(e) {
  const file = e.target.files[0]
  if (file) emit('file-selected', file)
}

function openPicker() {
  fileInput.value.click()
}
</script>

<template>
  <div class="max-w-xl mx-auto">
    <div
      class="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors"
      :class="dragOver
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-300 hover:border-gray-400 bg-white'"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="handleDrop"
      @click="openPicker"
    >
      <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p class="text-lg font-medium text-gray-700">
        Drop your file here or <span class="text-blue-600 underline">browse</span>
      </p>
      <p class="text-sm text-gray-500 mt-2">Supports .csv and .xlsx files</p>
    </div>
    <input
      ref="fileInput"
      type="file"
      accept=".csv,.xlsx,.xls"
      class="hidden"
      @change="handleFileInput"
    />
    <p class="text-xs text-gray-400 mt-3 text-center">
      Your data stays on your device and is never uploaded to a server.
    </p>
  </div>
</template>
