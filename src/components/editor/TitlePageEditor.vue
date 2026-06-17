<script setup lang="ts">
import { useReportStore } from '../../stores/report'
import { computed } from 'vue'

const store = useReportStore()
const t = computed(() => store.activeDocument?.titlePage)

function update(field: string, value: string) {
  store.updateTitlePage({ [field]: value } as never)
}
</script>

<template>
  <div v-if="t" class="title-page-editor">
    <h3 class="section-title">Титульна сторінка</h3>

    <div class="field-group">
      <label>Дисципліна</label>
      <input class="field-input" :value="t.discipline" @input="update('discipline', ($event.target as HTMLInputElement).value)" />
    </div>

    <div class="field-group">
      <label>Тип роботи</label>
      <input class="field-input" :value="t.workType" @input="update('workType', ($event.target as HTMLInputElement).value)" placeholder="лабораторної роботи" />
    </div>

    <div class="field-group">
      <label>Номер роботи</label>
      <input class="field-input" :value="t.workNumber" @input="update('workNumber', ($event.target as HTMLInputElement).value)" placeholder="1" />
    </div>

    <div class="field-group">
      <label>Тема роботи</label>
      <input class="field-input" :value="t.topic" @input="update('topic', ($event.target as HTMLInputElement).value)" />
    </div>

    <div class="field-group">
      <label>Університет</label>
      <input class="field-input" :value="t.university" @input="update('university', ($event.target as HTMLInputElement).value)" />
    </div>

    <div class="field-group">
      <label>Кафедра</label>
      <input class="field-input" :value="t.department" @input="update('department', ($event.target as HTMLInputElement).value)" />
    </div>

    <div class="field-group">
      <label>Група студента</label>
      <input class="field-input" :value="t.studentGroup" @input="update('studentGroup', ($event.target as HTMLInputElement).value)" />
    </div>

    <div class="field-group">
      <label>ПІБ студента</label>
      <input class="field-input" :value="t.studentName" @input="update('studentName', ($event.target as HTMLInputElement).value)" placeholder="Прізвище І. П." />
    </div>

    <div class="field-group">
      <label>Звання викладача</label>
      <input class="field-input" :value="t.teacherTitle" @input="update('teacherTitle', ($event.target as HTMLInputElement).value)" placeholder="PhD" />
    </div>

    <div class="field-group">
      <label>ПІБ викладача</label>
      <input class="field-input" :value="t.teacherName" @input="update('teacherName', ($event.target as HTMLInputElement).value)" placeholder="Прізвище І. П." />
    </div>

    <div class="field-row-two">
      <div class="field-group">
        <label>Місто</label>
        <input class="field-input" :value="t.city" @input="update('city', ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="field-group">
        <label>Рік</label>
        <input class="field-input" :value="t.year" @input="update('year', ($event.target as HTMLInputElement).value)" />
      </div>
    </div>
  </div>
</template>
