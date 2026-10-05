<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { bindInput, isWebMidiSupported, listInputs, listOutputs, requestMidiAccess, type MidiDeviceInfo } from '../../modules/midi/webMidi'
import { useSettingsStore } from '../../stores/settingsStore'

const settings = useSettingsStore()
const supported = isWebMidiSupported()
const inputs = ref<MidiDeviceInfo[]>([])
const outputs = ref<MidiDeviceInfo[]>([])
let access: Awaited<ReturnType<typeof requestMidiAccess>> = null

onMounted(async () => {
  if (!supported) return
  access = await requestMidiAccess()
  inputs.value = listInputs(access)
  outputs.value = listOutputs(access)
  bindInput(access, settings.midiInputId, () => {})
})
function selectInput(id: string) { settings.midiInputId = id; settings.persist(); bindInput(access, id, () => {}) }
function selectOutput(id: string) { settings.midiOutputId = id; settings.persist() }
</script>

<template>
  <section class="panel grid">
    <h2>MIDI devices</h2>
    <p v-if="!supported" class="muted">Browser không hỗ trợ Web MIDI API.</p>
    <template v-else>
      <label class="row">Input
        <select :value="settings.midiInputId" @change="selectInput(($event.target as HTMLSelectElement).value)">
          <option value="">Không chọn</option>
          <option v-for="device in inputs" :key="device.id" :value="device.id">{{ device.name }}</option>
        </select>
      </label>
      <label class="row">Output
        <select :value="settings.midiOutputId" @change="selectOutput(($event.target as HTMLSelectElement).value)">
          <option value="">Không chọn</option>
          <option v-for="device in outputs" :key="device.id" :value="device.id">{{ device.name }}</option>
        </select>
      </label>
    </template>
  </section>
</template>
