<script setup lang="ts">
import type { ListBlock } from '../../types/document'
import { useReportStore } from '../../stores/report'
import MarkerHint from './MarkerHint.vue'
import ListItemRow from './ListItemRow.vue'

const props = defineProps<{ block: ListBlock }>()
const emit = defineEmits<{
  update: [data: Partial<ListBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()

const store = useReportStore()
</script>

<template>
  <div class="block list-block">
    <div class="block-toolbar">
      <span class="block-type-label">≡ Список</span>
      <div class="list-type-toggle">
        <button
          :class="['level-btn', { active: !props.block.ordered }]"
          @click="emit('update', { ordered: false })"
        >• Марков.</button>
        <button
          :class="['level-btn', { active: props.block.ordered }]"
          @click="emit('update', { ordered: true })"
        >1. Нумер.</button>
      </div>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити">✕</button>
      </div>
    </div>

    <input
      class="block-input"
      :value="props.block.introText"
      @input="emit('update', { introText: ($event.target as HTMLInputElement).value })"
      placeholder="Вступний текст (необов'язково): "
    />

    <div class="list-items">
      <ListItemRow
        v-for="item in props.block.items"
        :key="item.id"
        :block-id="props.block.id"
        :item="item"
        :depth="0"
      />
    </div>

    <button class="btn-add-item" @click="store.addListItem(props.block.id)">
      + Додати елемент
    </button>
    <p class="block-hint">⤵ — додати підпункт</p>
    <MarkerHint />
  </div>
</template>
