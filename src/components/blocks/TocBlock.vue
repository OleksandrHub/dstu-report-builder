<script setup lang="ts">
import type { TocBlock } from '../../types/document'

const props = defineProps<{ block: TocBlock }>()
const emit = defineEmits<{
  update: [data: Partial<TocBlock>]
  remove: []
  moveUp: []
  moveDown: []
}>()
</script>

<template>
  <div class="block simple-block">
    <div class="block-toolbar">
      <span class="block-type-label">☰ Зміст</span>
      <div class="block-actions">
        <button @click="emit('moveUp')" title="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити">✕</button>
      </div>
    </div>
    <div class="block-field-row">
      <label>Заголовок:</label>
      <input
        class="block-input"
        :value="props.block.title"
        @input="emit('update', { title: ($event.target as HTMLInputElement).value })"
        placeholder="Зміст"
      />
    </div>
    <p class="block-hint">Збирається автоматично із заголовків (H1–H3). У Word онови поле (F9), щоб з'явились номери сторінок.</p>
  </div>
</template>
