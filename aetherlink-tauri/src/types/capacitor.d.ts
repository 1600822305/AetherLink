// Capacitor 相关类型定义
export type VibrateStyle = 'HEAVY' | 'MEDIUM' | 'LIGHT'
export type CameraSource = 'CAMERA' | 'PHOTOS'
export type ToastDuration = 'short' | 'long'

// 导出给 Vue 组件使用
declare global {
  type VibrateStyleType = VibrateStyle
  type CameraSourceType = CameraSource
  type ToastDurationType = ToastDuration
}
