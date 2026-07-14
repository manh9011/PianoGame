<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import { bindInput, isWebMidiSupported, listInputs, listOutputs, requestMidiAccess, type MidiDeviceInfo } from '../../modules/midi/webMidi'
import { useSettingsStore } from '../../stores/settingsStore'

const { t } = useI18n()
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

function selectInput(id: string) {
  settings.patchSettings({ midiInputId: id })
  bindInput(access, id, () => {})
}

function selectOutput(id: string) {
  settings.patchSettings({ midiOutputId: id })
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>{{ t('settings.musicDevices') }}</h2>
        <p>{{ t('settings.musicDevicesDescription') }}</p>
      </div>
      <span class="settings-pill">{{ supported ? t('settings.webMidi') : t('settings.unavailable') }}</span>
    </header>

    <SettingsSection :title="t('settings.musicInput')" :description="supported ? t('settings.musicInputDescription') : t('settings.midiUnsupported')">
      <SettingsRow :title="t('settings.synthesiaVirtualPiano')" :description="t('settings.virtualPianoDescription')">
        <span class="device-count">{{ t('settings.keys18') }}</span>
      </SettingsRow>
      <SettingsRow :title="t('settings.midiInput')" :description="t('settings.midiInputDescription')">
        <select class="settings-control" :disabled="!supported" :value="settings.midiInputId" @change="selectInput(($event.target as HTMLSelectElement).value)">
          <option value="">{{ t('settings.noneSelected') }}</option>
          <option v-for="device in inputs" :key="device.id" :value="device.id">{{ device.name }}</option>
        </select>
      </SettingsRow>
      <SettingsRow :title="t('settings.autoConnectLastInput')" :description="t('settings.autoConnectLastInputDescription')">
        <SettingsToggle :model-value="settings.musicDevicesAutoConnectInput" @change="settings.patchSettings({ musicDevicesAutoConnectInput: $event })" />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('settings.musicOutput')">
      <SettingsRow :title="t('settings.builtInMidiSynthesizer')" :description="t('settings.builtInSynthDescription')">
        <SettingsToggle :model-value="settings.musicDevicesPreferBuiltInSynth" @change="settings.patchSettings({ musicDevicesPreferBuiltInSynth: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.midiOutput')" :description="t('settings.midiOutputDescription')">
        <select class="settings-control" :disabled="!supported" :value="settings.midiOutputId" @change="selectOutput(($event.target as HTMLSelectElement).value)">
          <option value="">{{ t('settings.builtInMidiSynthesizer') }}</option>
          <option v-for="device in outputs" :key="device.id" :value="device.id">{{ device.name }}</option>
        </select>
      </SettingsRow>
      <SettingsRow :title="t('settings.autoConnectLastOutput')" :description="t('settings.autoConnectLastOutputDescription')">
        <SettingsToggle :model-value="settings.musicDevicesAutoConnectOutput" @change="settings.patchSettings({ musicDevicesAutoConnectOutput: $event })" />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>

<style scoped>
.device-count {
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.78rem;
}
</style>
