<script setup lang="ts">
import type { PageBreakBlock } from '../../types/document'

defineProps<{ block: PageBreakBlock }>()
const emit = defineEmits<{
  remove: []
  moveUp: []
  moveDown: []
}>()
</script>

<template>
  <div class="block simple-block">
    <div class="block-toolbar">
      <span class="block-type-label">⤓ Розрив сторінки</span>
      <div class="block-actions">
        <button @click="emit('moveUp')" title="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити">✕</button>
      </div>
    </div>
    <p class="block-hint">Наступний блок почнеться з нової сторінки.</p>
  </div>
</template>
