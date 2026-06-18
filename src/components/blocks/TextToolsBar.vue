<script setup lang="ts">
import { ref } from 'vue'
import { useReportStore } from '../../stores/report'

const store = useReportStore()
const open = ref(false)
const findText = ref('')
const replaceText = ref('')
const caseSensitive = ref(false)
const status = ref('')

function doReplace() {
  const n = store.replaceAllText(findText.value, replaceText.value, caseSensitive.value)
  status.value = n > 0 ? `Замінено в ${n} полях` : 'Збігів не знайдено'
}

function doDash() {
  const n = store.emDashToEnDash()
  status.value = n > 0 ? `Виправлено тире в ${n} полях` : 'Довгих тире не знайдено'
}
</script>

<template>
  <div class="text-tools">
    <button class="text-tools-toggle" @click="open = !open">
      {{ open ? '✕ Інструменти тексту' : '🛠 Інструменти тексту' }}
    </button>
    <div v-if="open" class="text-tools-panel">
      <div class="text-tools-row">
        <input class="block-input" v-model="findText" placeholder="Знайти" />
        <input class="block-input" v-model="replaceText" placeholder="Замінити на" />
      </div>
      <label class="ref-toggle">
        <input type="checkbox" v-model="caseSensitive" />
        <span>Враховувати регістр</span>
      </label>
      <div class="text-tools-row">
        <button class="btn-small" @click="doReplace">Замінити в усьому документі</button>
        <button class="btn-small" @click="doDash" title="— → –">— → – (тире)</button>
      </div>
      <p v-if="status" class="block-hint">{{ status }}</p>
    </div>
  </div>
</template>
