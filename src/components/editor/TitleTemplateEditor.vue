<script setup lang="ts">
import { ref, computed } from 'vue'
import { useReportStore } from '../../stores/report'
import type { TitleLineBlock, TitleSpacerBlock } from '../../types/document'

const store = useReportStore()
const doc = computed(() => store.activeDocument)

const newTemplateName = ref('')
const showSavePrompt = ref(false)
const showTemplates = ref(false)

function saveTpl() {
  const name = newTemplateName.value.trim()
  if (!name) return
  store.saveAsTemplate(name)
  newTemplateName.value = ''
  showSavePrompt.value = false
}

const VARS = [
  '{{ministry}}', '{{university}}', '{{department}}',
  '{{workType}}', '{{workNumber}}', '{{topic}}', '{{discipline}}',
  '{{studentGroup}}', '{{studentName}}',
  '{{teacherTitle}}', '{{teacherName}}',
  '{{city}}', '{{year}}',
]

function insertVar(blockId: string, v: string, currentText: string) {
  store.updateTitleBlock(blockId, { text: currentText + v } as Partial<TitleLineBlock>)
}
</script>

<template>
  <div v-if="doc" class="title-tpl-editor">
    <div class="tpl-toolbar">
      <button class="btn-sm" @click="store.resetTitleTemplate()" title="Скинути до стандарту">↺ Скинути</button>
      <button class="btn-sm btn-accent" @click="showSavePrompt = !showSavePrompt">💾 Зберегти шаблон</button>
      <button class="btn-sm" @click="showTemplates = !showTemplates">📂 Шаблони ({{ store.titleTemplates.length }})</button>
    </div>

    <!-- Save as template prompt -->
    <div v-if="showSavePrompt" class="save-prompt">
      <input
        class="field-input"
        v-model="newTemplateName"
        placeholder="Назва шаблону..."
        @keydown.enter="saveTpl"
      />
      <button class="btn-sm btn-accent" @click="saveTpl">Зберегти</button>
    </div>

    <!-- Templates list -->
    <div v-if="showTemplates && store.titleTemplates.length > 0" class="templates-list">
      <div
        v-for="tpl in store.titleTemplates"
        :key="tpl.id"
        class="tpl-item"
      >
        <span class="tpl-name">{{ tpl.name }}</span>
        <div class="tpl-actions">
          <button class="btn-sm" @click="store.applyTemplate(tpl.id)">Застосувати</button>
          <button class="btn-sm btn-danger" @click="store.deleteTemplate(tpl.id)">✕</button>
        </div>
      </div>
    </div>
    <div v-else-if="showTemplates" class="tpl-empty">Немає збережених шаблонів</div>

    <!-- Vars hint -->
    <div class="vars-hint">
      <span class="vars-label">Змінні:</span>
      <div class="vars-list">
        <code v-for="v in VARS" :key="v" class="var-chip">{{ v }}</code>
      </div>
    </div>

    <!-- Title blocks -->
    <div class="title-blocks-list">
      <div
        v-for="block in doc.titleTemplate"
        :key="block.id"
        class="title-block-item"
        :class="block.type === 'titleSpacer' ? 'spacer-block' : 'line-block'"
      >
        <!-- SPACER -->
        <template v-if="block.type === 'titleSpacer'">
          <div class="spacer-row">
            <span class="block-type-label">⟷ Відступ</span>
            <div class="spacer-flex-ctrl">
              <label>Розмір:</label>
              <input
                type="number" min="1" max="10" step="1"
                class="small-number-input"
                :value="(block as TitleSpacerBlock).flex"
                @input="store.updateTitleBlock(block.id, { flex: parseInt(($event.target as HTMLInputElement).value) || 1 })"
              />
            </div>
            <div class="block-actions">
              <button @click="store.moveTitleBlock(block.id, 'up')">↑</button>
              <button @click="store.moveTitleBlock(block.id, 'down')">↓</button>
              <button @click="store.addTitleBlock('titleLine', block.id)">+рядок</button>
              <button @click="store.addTitleBlock('titleSpacer', block.id)">+відступ</button>
              <button class="btn-danger" @click="store.removeTitleBlock(block.id)">✕</button>
            </div>
          </div>
        </template>

        <!-- LINE -->
        <template v-else>
          <div class="line-row">
            <div class="line-controls">
              <!-- Align buttons -->
              <div class="align-btns">
                <button
                  v-for="a in ['left','center','right']"
                  :key="a"
                  :class="['align-btn', { active: (block as TitleLineBlock).align === a }]"
                  @click="store.updateTitleBlock(block.id, { align: a as 'left'|'center'|'right' })"
                >{{ a === 'left' ? '⇤' : a === 'center' ? '⇔' : '⇥' }}</button>
              </div>
              <!-- Bold toggle -->
              <button
                :class="['bold-btn', { active: (block as TitleLineBlock).bold }]"
                @click="store.updateTitleBlock(block.id, { bold: !(block as TitleLineBlock).bold })"
              >B</button>
            </div>

            <input
              class="block-input line-text-input"
              :value="(block as TitleLineBlock).text"
              @input="store.updateTitleBlock(block.id, { text: ($event.target as HTMLInputElement).value })"
              placeholder="Текст рядка або {{змінна}}"
            />

            <div class="block-actions">
              <button @click="store.moveTitleBlock(block.id, 'up')" title="Вгору">↑</button>
              <button @click="store.moveTitleBlock(block.id, 'down')" title="Вниз">↓</button>
              <button @click="store.addTitleBlock('titleLine', block.id)" title="Додати рядок після">+L</button>
              <button @click="store.addTitleBlock('titleSpacer', block.id)" title="Додати відступ після">+S</button>
              <button class="btn-danger" @click="store.removeTitleBlock(block.id)">✕</button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Add at end -->
    <div class="add-title-block-row">
      <button class="btn-add-item" @click="store.addTitleBlock('titleLine')">+ Рядок</button>
      <button class="btn-add-item" @click="store.addTitleBlock('titleSpacer')">+ Відступ</button>
    </div>
  </div>
</template>
