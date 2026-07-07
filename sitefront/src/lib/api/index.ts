/* Единая точка входа в слой API. Страницы импортируют отсюда:

     import { api, ApiError, errorMessage } from '../../lib/api'
     const user = await api.auth.me()

   Так все обращения к серверу собраны в src/lib/api/ и подменяются в одном
   месте, а компоненты не знают про fetch и адреса. */

import * as auth from './auth'
import * as checks from './checks'
import * as profile from './profile'
import * as billing from './billing'
import * as stats from './stats'

export const api = { auth, checks, profile, billing, stats }

export { ApiError, apiConfigured, apiUrl, errorMessage } from './client'
export type * from './types'
