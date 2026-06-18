<script setup lang="ts">
import type { SourcesBlock, SourceEntry, SourceType } from '../../types/document'
import { formatSourceDSTU } from '../../types/document'
import { useReportStore } from '../../stores/report'

const props = defineProps<{ block: SourcesBlock }>()
const emit = defineEmits<{
  update: [data: Partial<SourcesBlock>]
  remove: []
  moveUp: []
  moveDown: []
}>()

const store = useReportStore()

const typeLabels: Record<SourceType, string> = {
  book: 'Книга', article: 'Стаття', electronic: 'Електронний ресурс',
}

function upd(id: string, data: Partial<SourceEntry>) {
  store.updateSource(props.block.id, id, data)
}
</script>

<template>
  <div class="block sources-block">
    <div class="block-toolbar">
      <span class="block-type-label">📚 Джерела (ДСТУ 2015)</span>
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
        placeholder="Список використаних джерел"
      />
    </div>

    <div v-for="(e, i) in props.block.entries" :key="e.id" class="source-entry">
      <div class="source-entry-head">
        <span class="source-num">{{ i + 1 }}.</span>
        <select class="style-select" :value="e.type" @change="upd(e.id, { type: ($event.target as HTMLSelectElement).value as SourceType })">
          <option v-for="(lbl, k) in typeLabels" :key="k" :value="k">{{ lbl }}</option>
        </select>
        <button class="btn-icon" @click="store.moveSource(props.block.id, e.id, 'up')" title="Вгору">↑</button>
        <button class="btn-icon" @click="store.moveSource(props.block.id, e.id, 'down')" title="Вниз">↓</button>
        <button class="btn-icon btn-danger" @click="store.removeSource(props.block.id, e.id)" :disabled="props.block.entries.length <= 1">✕</button>
      </div>

      <input class="block-input" :value="e.authors" @input="upd(e.id, { authors: ($event.target as HTMLInputElement).value })" placeholder="Автори: Прізвище І. П., …" />
      <input class="block-input" :value="e.title" @input="upd(e.id, { title: ($event.target as HTMLInputElement).value })" placeholder="Назва праці" />

      <template v-if="e.type === 'book'">
        <div class="source-grid">
          <input class="block-input" :value="e.city" @input="upd(e.id, { city: ($event.target as HTMLInputElement).value })" placeholder="Місто" />
          <input class="block-input" :value="e.publisher" @input="upd(e.id, { publisher: ($event.target as HTMLInputElement).value })" placeholder="Видавництво" />
          <input class="block-input" :value="e.year" @input="upd(e.id, { year: ($event.target as HTMLInputElement).value })" placeholder="Рік" />
          <input class="block-input" :value="e.pages" @input="upd(e.id, { pages: ($event.target as HTMLInputElement).value })" placeholder="256 с." />
        </div>
      </template>
      <template v-else-if="e.type === 'article'">
        <input class="block-input" :value="e.journal" @input="upd(e.id, { journal: ($event.target as HTMLInputElement).value })" placeholder="Назва журналу / збірника" />
        <div class="source-grid">
          <input class="block-input" :value="e.year" @input="upd(e.id, { year: ($event.target as HTMLInputElement).value })" placeholder="Рік" />
          <input class="block-input" :value="e.pages" @input="upd(e.id, { pages: ($event.target as HTMLInputElement).value })" placeholder="С. 12–20." />
        </div>
      </template>
      <template v-else>
        <input class="block-input" :value="e.url" @input="upd(e.id, { url: ($event.target as HTMLInputElement).value })" placeholder="URL" />
        <input class="block-input" :value="e.accessDate" @input="upd(e.id, { accessDate: ($event.target as HTMLInputElement).value })" placeholder="Дата звернення: 18.06.2026" />
      </template>

      <p class="block-hint source-preview">{{ i + 1 }}. {{ formatSourceDSTU(e) }}</p>
    </div>

    <button class="btn-add-item" @click="store.addSource(props.block.id)">+ Додати джерело</button>
  </div>
</template>
