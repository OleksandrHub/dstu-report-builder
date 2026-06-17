<script setup lang="ts">
import { useReportStore } from '../../stores/report'
import { computed } from 'vue'

const store = useReportStore()
const intro = computed(() => store.activeDocument?.intro)

function update(field: string, value: string) {
  store.updateIntro({ [field]: value } as never)
}
</script>

<template>
  <div v-if="intro" class="intro-editor">
    <h3 class="section-title">Вступна частина</h3>

    <div class="field-group">
      <label>Тема</label>
      <input class="field-input" :value="intro.topic" @input="update('topic', ($event.target as HTMLInputElement).value)" />
    </div>

    <div class="field-group">
      <label>Мета</label>
      <textarea class="field-input field-textarea" :value="intro.goal" @input="update('goal', ($event.target as HTMLTextAreaElement).value)" rows="2" />
    </div>

    <div class="field-group">
      <label>Варіант</label>
      <input class="field-input" style="width: 80px" :value="intro.variant" @input="update('variant', ($event.target as HTMLInputElement).value)" />
    </div>
  </div>
</template>
