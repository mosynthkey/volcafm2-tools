/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Composables
import { createVuetify } from 'vuetify'

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#211a1b',
          surface: '#382b2d',
          primary: '#ceb393',
          secondary: '#50ddd5',
          success: '#50ddd5',
          info: '#50ddd5',
          warning: '#ceb393',
          error: '#f06b97',
        },
      },
    },
  },
})
