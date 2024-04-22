export const account_kind = {
    user: 0,
    group: 1,
    resource: 2,
    team: 3
}

export const file_type = {
    embedded: 1,
    linked: 2,
    remote: 4,
    large: 5
}

export const access_code = {
    search: 1,
    read: 2,
    write: 4,
    delete: 8,
    showcontent: 16,
    addcontent: 32,
    modifycontent: 64,
    deletecontent: 128,
    secure: 256,
    fullcontrol: 271,
    securecontent: 512,
    nocontent: 2048
}