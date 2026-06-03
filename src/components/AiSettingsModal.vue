<template>
  <n-modal
    :show="show"
    preset="card"
    title="AI 模型配置"
    style="width: 520px"
    @update:show="val => emit('update:show', val)"
  >
    <n-space vertical size="large">
      <n-form-item label="Base URL" :show-feedback="false">
        <n-input
          v-model:value="baseUrl"
          placeholder="例如：https://api.openai.com/v1（填到 /v1 为止）"
          @update:value="handleConfigChange"
        />
      </n-form-item>

      <n-form-item label="API Key（无需鉴权可留空）" :show-feedback="false">
        <n-input
          v-model:value="apiKey"
          type="password"
          show-password-on="click"
          placeholder="sk-..."
          @update:value="handleConfigChange"
        />
      </n-form-item>

      <n-form-item label="模型" :show-feedback="false">
        <n-space vertical style="width: 100%">
          <n-space>
            <n-button
              :loading="loadingModels"
              :disabled="!baseUrl.trim()"
              @click="handleFetchModels"
            >
              获取模型
            </n-button>
            <span v-if="status === 'success'" class="status-ok">已获取 {{ modelOptions.length }} 个模型</span>
            <span v-if="status === 'error'" class="status-err">{{ errorMsg }}</span>
          </n-space>
          <n-select
            v-model:value="model"
            :options="modelOptions"
            :disabled="modelOptions.length === 0"
            placeholder="请先获取模型，再选择"
            filterable
          />
        </n-space>
      </n-form-item>
    </n-space>

    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :disabled="!canSave" @click="handleSave">保存</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { aiSettings } from '@/utils/storage'
import { fetchModels } from '@/api/ai'

const props = defineProps({
  show: { type: Boolean, default: false }
})
const emit = defineEmits(['update:show', 'saved'])

const message = useMessage()

const baseUrl = ref('')
const apiKey = ref('')
const model = ref('')
const modelOptions = ref([])
const loadingModels = ref(false)
const status = ref('') // '' | 'success' | 'error'
const errorMsg = ref('')

// 弹窗打开时回填已存配置；若已配模型则把它作为唯一可选项，避免显示空
watch(() => props.show, (open) => {
  if (!open) return
  const cfg = aiSettings.getConfig()
  baseUrl.value = cfg.baseUrl
  apiKey.value = cfg.apiKey
  model.value = cfg.model
  modelOptions.value = cfg.model ? [{ label: cfg.model, value: cfg.model }] : []
  status.value = ''
  errorMsg.value = ''
})

// 改动 baseUrl/apiKey 后，旧的模型列表可能失效，需重新获取后才能保存
const handleConfigChange = () => {
  status.value = ''
  modelOptions.value = []
  model.value = ''
}

const handleFetchModels = async () => {
  loadingModels.value = true
  status.value = ''
  errorMsg.value = ''
  try {
    const ids = await fetchModels({ baseUrl: baseUrl.value.trim(), apiKey: apiKey.value.trim() })
    modelOptions.value = ids.map(id => ({ label: id, value: id }))
    // 若原选中模型已不在列表中则清空，强制用户重新选择
    if (!ids.includes(model.value)) model.value = ids.length === 1 ? ids[0] : ''
    status.value = 'success'
  } catch (err) {
    console.error(err)
    modelOptions.value = []
    model.value = ''
    status.value = 'error'
    errorMsg.value = '无法获取模型列表，请检查配置'
  } finally {
    loadingModels.value = false
  }
}

// 仅在成功拉到模型并选定后才允许保存（拉不到 models 即判定配置有问题）
const canSave = computed(() =>
  status.value === 'success' && modelOptions.value.length > 0 && Boolean(model.value)
)

const handleSave = () => {
  aiSettings.setConfig({
    apiKey: apiKey.value.trim(),
    baseUrl: baseUrl.value.trim(),
    model: model.value
  })
  message.success('AI 配置已保存')
  emit('saved')
  emit('update:show', false)
}
</script>

<style scoped>
.status-ok {
  color: #18a058;
  font-size: 13px;
  line-height: 34px;
}
.status-err {
  color: #d03050;
  font-size: 13px;
  line-height: 34px;
}
</style>
